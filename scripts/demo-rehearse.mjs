// Cold-start rehearsal of the whole local demo. Run from anywhere:
//   node scripts/demo-rehearse.mjs [--port N] [--skip-build] [--full]      (--help prints the flags)
// Plain Node ESM with only node: imports, so it needs no install. It never uses npm or a shell: every child
// is started with process.execPath, so it behaves the same on Windows and Linux.
//
// Steps (the first failure stops the run with "DEMO REHEARSAL FAILED at step N (name): reason"):
//   1 preflight   2 stop the node THIS tooling started   3 cold start   4 compile and deploy   5 verify the deploy
//   6 build (or reuse of this script's own build with --skip-build)   7 golden path (demo-rehearsal e2e) on the clean chain
//   8 regression: seller-ocr, seller-live and buyer-live, or the whole unfiltered e2e suite with --full
// Always, at the end: stop the node this run started, restore a deployedAt-only change to the deployments files,
// and restore web/next-env.d.ts when it was clean before the run.
// Logs go to <repo>/.scratch/rehearsal-<timestamp>.log (git-ignored).
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webDir = path.join(root, "web");
const contractsDir = path.join(root, "contracts");
const scratch = path.join(root, ".scratch");
const RPC = "http://127.0.0.1:8545";

const USAGE = [
  "usage: node scripts/demo-rehearse.mjs [--port N] [--skip-build] [--full]",
  "  --port N       port for the test web server (default 3180)",
  "  --skip-build   reuse web/.next only if THIS script built it and it holds the deployed registry address",
  "  --full         after the golden path run the whole unfiltered e2e suite, not just the demo scripts",
  "  --help         print this text",
].join("\n");

// ---- args ----
const argv = process.argv.slice(2);
let port = 3180;
let skipBuild = false;
let full = false;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--help") {
    console.log(USAGE);
    process.exit(0);
  } else if (argv[i] === "--port" && /^\d+$/.test(argv[i + 1] ?? "")) port = Number(argv[++i]);
  else if (argv[i] === "--skip-build") skipBuild = true;
  else if (argv[i] === "--full") full = true;
  else {
    console.log(USAGE);
    process.exit(1);
  }
}

// ---- logging: every line to the console and to the log file ----
fs.mkdirSync(scratch, { recursive: true });
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
const logPath = path.join(scratch, `rehearsal-${stamp}.log`);
const logFd = fs.openSync(logPath, "w");
const emit = (text) => {
  process.stdout.write(text);
  fs.writeSync(logFd, text);
};
const say = (line) => emit(`rehearse: ${line}\n`);

// ---- child processes (PD-16: the rehearsal is always local and flag-off) ----
// A Sepolia key, RPC URL or flag in the shell must never reach the local deploy, build or logs. Values are
// removed or blanked here and never read, printed or logged.
function childEnv() {
  const env = { ...process.env };
  delete env.RPC_URL;
  delete env.DEPLOYER_PRIVATE_KEY;
  env.NEXT_PUBLIC_ENABLE_SEPOLIA = "";
  env.NEXT_PUBLIC_OPAQUELY_DATA = "";
  return env;
}

/** Run `node <args>` and stream its output live (unprefixed). Resolves { code, out }. */
function runNode(args, cwd = root) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd, env: childEnv(), stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let out = "";
    const onData = (buf) => {
      const text = buf.toString("utf8");
      out += text;
      emit(text);
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", (err) => {
      onData(Buffer.from(`could not start node: ${err.message}\n`));
      resolve({ code: 1, out });
    });
    child.on("close", (code) => resolve({ code: code ?? 1, out }));
  });
}

const git = (args) => spawnSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });

async function nodeAnswers() {
  return fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
    signal: AbortSignal.timeout(2_000),
  }).then(async (r) => (r.ok ? (await r.json()).result ?? null : null), () => null);
}

class StepFailure extends Error {
  constructor(step, name, reason) {
    super(reason);
    this.step = step;
    this.stepName = name;
  }
}

const devNode = path.join(contractsDir, "scripts", "dev-node.mjs");
const buildRecordPath = path.join(scratch, "rehearsal-build.json");
const buildIdPath = path.join(webDir, ".next", "BUILD_ID");
const readBuildId = () => (fs.existsSync(buildIdPath) ? fs.readFileSync(buildIdPath, "utf8").trim() : null);

/** True when some file under web/.next/static contains the address (case-insensitive). */
function bundleHasAddress(address) {
  const needle = address.toLowerCase();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (walk(p)) return true;
      } else if (/\.(js|json|html|txt)$/.test(entry.name) && fs.readFileSync(p, "utf8").toLowerCase().includes(needle)) {
        return true;
      }
    }
    return false;
  };
  const staticDir = path.join(webDir, ".next", "static");
  return fs.existsSync(staticDir) && walk(staticDir);
}
const durations = [];
const t0 = Date.now();
let startedNode = false;
let envWasClean = true;
let failure = null;

async function step(n, name, fn) {
  const at = Date.now();
  say(`step ${n}: ${name}`);
  try {
    await fn();
  } finally {
    durations.push(`${n} ${name} ${Math.round((Date.now() - at) / 1000)}s`);
  }
}

async function main() {
  await step(1, "preflight", async () => {
    if (Number(process.versions.node.split(".")[0]) < 22) {
      throw new StepFailure(1, "preflight", `Node ${process.versions.node} is too old; use Node 22 or newer`);
    }
    const busy = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(2_000) }).then(() => true, () => false);
    if (busy) throw new StepFailure(1, "preflight", `port ${port} is busy; pass --port <free port>`);
    // PD-16: a web/.env.local that turns Sepolia on, or forces the stub, would make this a different demo.
    const envFile = path.join(webDir, ".env.local");
    if (fs.existsSync(envFile)) {
      for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
        const m = line.match(/^\s*(NEXT_PUBLIC_ENABLE_SEPOLIA|NEXT_PUBLIC_OPAQUELY_DATA)\s*=\s*["']?([^"'\s#]*)/);
        if (!m) continue;
        const turnsOn = (m[1] === "NEXT_PUBLIC_ENABLE_SEPOLIA" && m[2] === "1") || (m[1] === "NEXT_PUBLIC_OPAQUELY_DATA" && m[2] === "stub");
        if (turnsOn) {
          // Only the variable name is printed, never the file contents.
          throw new StepFailure(1, "preflight", `web/.env.local turns on ${m[1]}; the rehearsal proves the local demo, so comment that line out and rerun`);
        }
      }
    }
    envWasClean = git(["status", "--porcelain", "web/next-env.d.ts"]).stdout.trim() === "";
  });

  await step(2, "stop the node this tooling started", async () => {
    const r = await runNode([devNode, "stop"]);
    if (r.code !== 0) {
      throw new StepFailure(
        2,
        "stop",
        "a node that this script did not start answers on 127.0.0.1:8545. Stop it yourself, then rerun. It was left running.",
      );
    }
  });

  await step(3, "cold start", async () => {
    const r = await runNode([devNode, "start"]);
    if (r.code !== 0 || !r.out.includes("hardhat node up")) {
      throw new StepFailure(3, "cold start", "the node did not cold start (no 'hardhat node up' line)");
    }
    startedNode = true;
    const head = Number.parseInt((await nodeAnswers()) ?? "", 16);
    if (!Number.isFinite(head) || head >= 50) {
      throw new StepFailure(3, "cold start", `the chain is not fresh (block ${head}); a cold start has fewer than 50 blocks`);
    }
  });

  await step(4, "compile and deploy", async () => {
    const hardhatCli = path.join(contractsDir, "node_modules", "hardhat", "dist", "src", "cli.js");
    const compile = await runNode([hardhatCli, "compile"], contractsDir);
    if (compile.code !== 0) throw new StepFailure(4, "compile and deploy", "hardhat compile failed");
    const deploy = await runNode([path.join(contractsDir, "scripts", "deploy.mjs")]);
    if (deploy.code !== 0) throw new StepFailure(4, "compile and deploy", "the deploy failed");
  });

  await step(5, "verify the deploy", async () => {
    const r = await runNode([path.join(contractsDir, "scripts", "verify-deploy.mjs")]);
    if (r.code !== 0 || !r.out.includes("DEPLOY VERIFIED")) throw new StepFailure(5, "verify", "verify-deploy did not print DEPLOY VERIFIED");
  });

  await step(6, "build", async () => {
    if (skipBuild) {
      // PD-15: trust only a build this script made. Any other bundle might be a flag-on Sepolia build.
      const registry = JSON.parse(fs.readFileSync(path.join(webDir, "src", "contracts", "deployments.json"), "utf8"))["31337"].DatasetRegistry.address;
      const record = fs.existsSync(buildRecordPath) ? JSON.parse(fs.readFileSync(buildRecordPath, "utf8")) : null;
      const buildId = readBuildId();
      let reason = null;
      if (!record) reason = "no rehearsal build record";
      else if (!buildId || record.buildId !== buildId) reason = "BUILD_ID differs from the rehearsal record";
      else if (!bundleHasAddress(registry)) reason = "registry address not in the bundle";
      if (!reason) {
        say(`build skipped (rehearsal build ${buildId}, registry ${registry} in bundle)`);
        return;
      }
      say(`rebuilding (${reason})`);
    }
    const r = await runNode([path.join(webDir, "node_modules", "next", "dist", "bin", "next"), "build"], webDir);
    if (r.code !== 0) throw new StepFailure(6, "build", "next build failed");
    fs.writeFileSync(buildRecordPath, JSON.stringify({ buildId: readBuildId(), at: new Date().toISOString() }) + "\n");
  });

  await step(7, "golden path", async () => {
    const r = await runNode([path.join(webDir, "e2e", "run-all.mjs"), "--port", String(port), "demo-rehearsal"], webDir);
    if (r.code !== 0 || !r.out.includes("PASS demo-rehearsal")) throw new StepFailure(7, "golden path", "the demo-rehearsal e2e did not pass");
  });

  await step(8, full ? "regression (full suite)" : "regression", async () => {
    // Default: the demo scripts. --full: every e2e script (with the node up all of them run, including a second,
    // delta-based demo-rehearsal).
    const names = full ? [] : ["seller-ocr", "seller-live", "buyer-live"];
    const r = await runNode([path.join(webDir, "e2e", "run-all.mjs"), "--port", String(port), ...names], webDir);
    if (r.code !== 0 || !/^E2E OK/m.test(r.out)) throw new StepFailure(8, "regression", "the e2e regression run did not end with E2E OK");
  });
}

/** Restore the generated deployments files only when every changed line is a deployedAt line (T-06-03). */
function restoreDeployments() {
  const files = ["web/src/contracts/deployments.json", "web/src/contracts/deployments.ts"];
  const diff = git(["diff", "-U0", "--", ...files]).stdout;
  const changed = diff.split(/\r?\n/).filter((l) => /^[+-]/.test(l) && !l.startsWith("+++") && !l.startsWith("---"));
  if (changed.length === 0) return;
  if (changed.every((l) => l.includes('"deployedAt"'))) {
    git(["checkout", "--", ...files]);
    say("restored the deployments files (only deployedAt had changed)");
  } else {
    say("NOTE deployments differ from git beyond deployedAt; left as is");
  }
}

try {
  await main();
} catch (err) {
  failure = err instanceof StepFailure ? err : new StepFailure(0, "unexpected", err instanceof Error ? err.message : String(err));
} finally {
  if (startedNode) await runNode([devNode, "stop"]);
  try {
    restoreDeployments();
    if (envWasClean && git(["status", "--porcelain", "web/next-env.d.ts"]).stdout.trim() !== "") {
      git(["checkout", "--", "web/next-env.d.ts"]);
      say("restored web/next-env.d.ts");
    }
  } catch (err) {
    say(`NOTE cleanup problem: ${err instanceof Error ? err.message : String(err)}`);
  }
}

say("step durations: " + durations.join(", "));
const secs = Math.round((Date.now() - t0) / 1000);
if (failure) {
  emit(`DEMO REHEARSAL FAILED at step ${failure.step} (${failure.stepName}): ${failure.message}\n`);
  fs.closeSync(logFd);
  process.exit(1);
}
emit(`DEMO REHEARSAL OK (${Math.floor(secs / 60)}m${secs % 60}s) log: ${logPath}\n`);
fs.closeSync(logFd);
process.exit(0);
