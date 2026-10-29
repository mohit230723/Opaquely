// One command: deploy DatasetRegistry, then Marketplace, then link them, then write ABIs and addresses
// into the web app keyed by chainId. Run with the node up:  npm run deploy   (= hardhat compile + this)
//
//   RPC_URL                 default http://127.0.0.1:8545
//   DEPLOYER_PRIVATE_KEY    optional, with or without 0x. Without it the node's first unlocked account is used
//                           (local node only). Read from the environment only: the key is never printed or
//                           written, and a malformed one is rejected without echoing it.
//   On any chain other than 31337 a preflight prints the chain id, the deployer address and its balance, and
//   stops before sending anything when the balance is zero. The local deploy prints and does what it always did.
//   ANOMALY_THRESHOLD_CENTS default 500000
//   --out <dir>             default ../web/src/contracts   (tests point this at a scratch dir)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, http, getAddress, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outIdx = process.argv.indexOf("--out");
if (outIdx > -1 && outIdx === process.argv.length - 1) throw new Error("--out needs a directory");
const outDir = path.resolve(outIdx > -1 ? process.argv[outIdx + 1] : path.join(root, "..", "web", "src", "contracts"));
const rpcUrl = process.env.RPC_URL ?? "http://127.0.0.1:8545";
// Only the origin is ever printed: a provider URL can carry its API key in the path or query.
const safeRpc = (() => {
  try {
    return new URL(rpcUrl).origin;
  } catch {
    return "RPC_URL";
  }
})();
const threshold = BigInt(process.env.ANOMALY_THRESHOLD_CENTS ?? "500000");

function artifact(name) {
  const file = path.join(root, "artifacts", "contracts", `${name}.sol`, `${name}.json`);
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}. Run "npx hardhat compile" first.`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const publicClient = createPublicClient({ transport: http(rpcUrl) });
const chainId = await publicClient.getChainId().catch(() => {
  throw new Error(`No node answers at ${safeRpc}. Start one with: node scripts/dev-node.mjs start`);
});

/** Trim, add a missing 0x, and accept only 32 hex bytes. The value is never put into an error message. */
function normalisePrivateKey(raw) {
  const trimmed = raw.trim();
  const key = /^0x/i.test(trimmed) ? "0x" + trimmed.slice(2) : "0x" + trimmed;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("DEPLOYER_PRIVATE_KEY is not a valid 32-byte hex private key");
  return key;
}

let account;
if (process.env.DEPLOYER_PRIVATE_KEY) account = privateKeyToAccount(normalisePrivateKey(process.env.DEPLOYER_PRIVATE_KEY));
else {
  const accounts = await publicClient.request({ method: "eth_accounts" });
  if (!accounts || accounts.length === 0) throw new Error("No unlocked account at " + safeRpc + "; set DEPLOYER_PRIVATE_KEY");
  account = getAddress(accounts[0]);
}
const wallet = createWalletClient({ account, transport: http(rpcUrl) });

// Preflight for real chains only: show where and with what balance we are about to deploy, and refuse an
// empty wallet before any transaction is sent. Never prints the key.
if (chainId !== 31337) {
  const deployer = typeof account === "string" ? account : account.address;
  const balance = await publicClient.getBalance({ address: deployer });
  console.log(`deploy target: chain ${chainId}, deployer ${deployer}, balance ${formatEther(balance)} ETH`);
  if (balance === 0n) {
    console.error(`The deployer ${deployer} has 0 ETH on chain ${chainId}. Fund it from a Sepolia faucet, then rerun. Nothing was sent.`);
    process.exit(1);
  }
}

async function deploy(name, args) {
  const art = artifact(name);
  const hash = await wallet.deployContract({ abi: art.abi, bytecode: art.bytecode, args, chain: null });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress) throw new Error(`${name} deployment failed`);
  console.log(`${name} -> ${receipt.contractAddress} (block ${receipt.blockNumber})`);
  return { art, address: getAddress(receipt.contractAddress), block: receipt.blockNumber };
}

// If a later step fails, contracts already deployed stay on chain (gas spent) and nothing is recorded, so a rerun deploys again.
const registry = await deploy("DatasetRegistry", [threshold]);
const market = await deploy("Marketplace", [registry.address]);
const linkHash = await wallet.writeContract({
  address: registry.address,
  abi: registry.art.abi,
  functionName: "setMarketplace",
  args: [market.address],
  chain: null,
});
const linkReceipt = await publicClient.waitForTransactionReceipt({ hash: linkHash });
if (linkReceipt.status !== "success") throw new Error("setMarketplace reverted; nothing was written to deployments.json");
console.log("linked: registry.setMarketplace(" + market.address + ")");

// The Marketplace reverts with the registry's errors (TooFewBills, DatasetIsSealed, ...). viem can only decode
// them with the ABI of the contract it called, so ship the registry's error fragments inside the Marketplace ABI.
const marketAbi = [...market.art.abi];
for (const item of registry.art.abi) {
  if (item.type === "error" && !marketAbi.some((m) => m.type === "error" && m.name === item.name)) marketAbi.push(item);
}

const file = path.join(outDir, "deployments.json");
fs.mkdirSync(outDir, { recursive: true });
const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
all[String(chainId)] = {
  chainId,
  deployedAt: new Date().toISOString(),
  deployBlock: Number(Math.min(Number(registry.block), Number(market.block))),
  anomalyThresholdCents: threshold.toString(),
  DatasetRegistry: { address: registry.address, abi: registry.art.abi },
  Marketplace: { address: market.address, abi: marketAbi },
};
fs.writeFileSync(file, JSON.stringify(all, null, 2) + "\n");
fs.writeFileSync(
  path.join(outDir, "deployments.ts"),
  "// GENERATED by contracts/scripts/deploy.mjs. Do not edit; rerun the deploy.\n" +
    "export const deployments = " + JSON.stringify(all, null, 2) + " as const;\n",
);
console.log(`wrote ${file} (chains: ${Object.keys(all).join(", ")})`);
