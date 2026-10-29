// Preflight tests for deploy.mjs against a fake JSON-RPC server on 127.0.0.1. Never talks to a real chain.
// Run:  node --test contracts/scripts/deploy.test.mjs   (Hardhat's mocha only reads contracts/test/)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const deployScript = path.join(here, "deploy.mjs");
const scratchRoot = path.resolve(here, "..", "..", ".scratch");

// The public Hardhat #0 test key (already committed in web/e2e), here without its 0x prefix.
const PUBLIC_KEY_HEX = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const PUBLIC_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const MALFORMED = "not-a-real-key-zzzz";

let server;
let rpcUrl;
let balanceHex = "0x0";
let methods = [];
const outDirs = [];

before(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const answer = (m) => {
        methods.push(m.method);
        const base = { jsonrpc: "2.0", id: m.id };
        if (m.method === "eth_chainId") return { ...base, result: "0xaa36a7" };
        if (m.method === "eth_getBalance") return { ...base, result: balanceHex };
        if (m.method === "eth_accounts") return { ...base, result: [] };
        return { ...base, error: { code: -32601, message: "fake server: method not supported" } };
      };
      const parsed = JSON.parse(body);
      const out = Array.isArray(parsed) ? parsed.map(answer) : answer(parsed);
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(out));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  rpcUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  for (const dir of outDirs) fs.rmSync(dir, { recursive: true, force: true });
});

function runDeploy(key) {
  fs.mkdirSync(scratchRoot, { recursive: true });
  const outDir = fs.mkdtempSync(path.join(scratchRoot, "deploy-test-"));
  outDirs.push(outDir);
  methods = [];
  const env = { ...process.env, RPC_URL: rpcUrl };
  if (key === undefined) delete env.DEPLOYER_PRIVATE_KEY;
  else env.DEPLOYER_PRIVATE_KEY = key;
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [deployScript, "--out", outDir], { env });
    let output = "";
    child.stdout.on("data", (c) => (output += c));
    child.stderr.on("data", (c) => (output += c));
    child.on("close", (code) => resolve({ code, output, outDir, methods: [...methods] }));
  });
}

const SENT = ["eth_sendRawTransaction", "eth_sendTransaction"];

test("an unfunded key (no 0x) on a real chain stops before sending anything and never prints the key", async () => {
  balanceHex = "0x0";
  const r = await runDeploy(PUBLIC_KEY_HEX);
  assert.equal(r.code, 1);
  assert.ok(r.output.includes(PUBLIC_ADDRESS), r.output);
  assert.ok(r.output.includes("faucet"), r.output);
  assert.ok(r.output.includes("Nothing was sent"), r.output);
  assert.ok(!r.output.includes(PUBLIC_KEY_HEX), "the key hex must not be printed");
  assert.ok(r.methods.includes("eth_getBalance"));
  for (const m of SENT) assert.ok(!r.methods.includes(m), `${m} must not be called`);
  assert.ok(!fs.existsSync(path.join(r.outDir, "deployments.json")));
});

test("a malformed key is rejected without echoing it", async () => {
  const r = await runDeploy(MALFORMED);
  assert.equal(r.code, 1);
  assert.ok(r.output.includes("DEPLOYER_PRIVATE_KEY is not a valid 32-byte hex private key"), r.output);
  assert.ok(!r.output.includes(MALFORMED), "the malformed value must not be echoed");
  assert.ok(!fs.existsSync(path.join(r.outDir, "deployments.json")));
});

test("no key and no unlocked accounts says to set DEPLOYER_PRIVATE_KEY", async () => {
  const r = await runDeploy(undefined);
  assert.equal(r.code, 1);
  assert.ok(r.output.includes("DEPLOYER_PRIVATE_KEY"), r.output);
  assert.ok(r.output.includes("No unlocked account"), r.output);
  assert.ok(!fs.existsSync(path.join(r.outDir, "deployments.json")));
});

test("a funded key prints the deploy target, then fails at the fake server without writing anything", async () => {
  balanceHex = "0xde0b6b3a7640000"; // 1 ETH
  const r = await runDeploy(PUBLIC_KEY_HEX);
  assert.notEqual(r.code, 0);
  assert.ok(
    r.output.includes(`deploy target: chain 11155111, deployer ${PUBLIC_ADDRESS}, balance 1 ETH`),
    r.output,
  );
  assert.ok(!r.output.includes(PUBLIC_KEY_HEX), "the key hex must not be printed");
  assert.ok(!fs.existsSync(path.join(r.outDir, "deployments.json")));
});
