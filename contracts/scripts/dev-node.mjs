// Start or stop `hardhat node` as a detached background process (works from an agent shell on Windows).
// Usage: node contracts/scripts/dev-node.mjs start | stop   (runnable from any cwd)
// PID file: <repo>/.scratch/hardhat-node.pid, log: <repo>/.scratch/hardhat-node.log
// The node is bound to 127.0.0.1:8545 only (never 0.0.0.0).
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const contractsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(contractsDir, "..");
const scratch = path.join(repoRoot, ".scratch");
const pidFile = path.join(scratch, "hardhat-node.pid");
const logFile = path.join(scratch, "hardhat-node.log");
const RPC = "http://127.0.0.1:8545";
// FHEVM ACL contract at the address the @zama-fhe/sdk `hardhat` preset uses (cleartext stack).
const ACL_ADDRESS = "0x50157CFfD6bBFA2DECe204a89ec419c23ef5755D";

async function rpc(method, params = []) {
  try {
    const r = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    return (await r.json()).result ?? null;
  } catch {
    return null;
  }
}

const chainId = () => rpc("eth_chainId");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function killTree(pid) {
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    } catch {
      // already gone ("not found")
    }
  } else {
    try {
      // the detached child leads its own process group
      process.kill(-pid, "SIGTERM");
    } catch {
      // already gone
    }
  }
}

async function start() {
  if (await chainId()) {
    console.log("a node already answers on " + RPC + "; not starting another");
    return 0;
  }
  fs.mkdirSync(scratch, { recursive: true });
  const out = fs.openSync(logFile, "w");
  const cli = path.join(contractsDir, "node_modules/hardhat/dist/src/cli.js");
  const child = spawn(process.execPath, [cli, "node", "--hostname", "127.0.0.1"], {
    cwd: contractsDir,
    detached: true,
    stdio: ["ignore", out, out],
    windowsHide: true,
  });
  fs.writeFileSync(pidFile, String(child.pid));
  child.unref();

  for (let i = 0; i < 120; i++) {
    if ((await chainId()) === "0x7a69") {
      const code = await rpc("eth_getCode", [ACL_ADDRESS, "latest"]);
      if (!code || code === "0x") {
        killTree(child.pid);
        fs.rmSync(pidFile, { force: true });
        console.log("node up but no FHEVM ACL code; see " + logFile);
        return 1;
      }
      console.log("hardhat node up (pid " + child.pid + ", chainId 31337, FHEVM ACL deployed)");
      return 0;
    }
    await sleep(1000);
  }
  console.log("hardhat node did not come up in 120 s; see " + logFile);
  return 1;
}

async function stop() {
  if (!fs.existsSync(pidFile)) {
    if (await chainId()) {
      console.log("a node answers on 127.0.0.1:8545 but this script did not start it");
      return 1;
    }
    console.log("no pid file; 127.0.0.1:8545 is free");
    return 0;
  }
  const pid = fs.readFileSync(pidFile, "utf8").trim();
  killTree(pid);
  fs.rmSync(pidFile, { force: true });
  for (let i = 0; i < 15; i++) {
    if (!(await chainId())) {
      console.log("stopped pid " + pid + "; 127.0.0.1:8545 is free");
      return 0;
    }
    await sleep(1000);
  }
  console.log("port 8545 still answers after stop");
  return 1;
}

const cmd = process.argv[2];
if (cmd === "start") process.exit(await start());
else if (cmd === "stop") process.exit(await stop());
else {
  console.log("usage: node contracts/scripts/dev-node.mjs start|stop");
  process.exit(1);
}
