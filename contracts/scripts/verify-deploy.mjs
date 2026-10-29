// Proves a deployments file works, using nothing but the file and a JSON-RPC node.
//
// It checks: the entry for the node's chain id, bytecode at both addresses, the registry and marketplace
// pointing at each other, the constants the web app relies on, the error names the UI will decode, and that a
// registry error raised through Marketplace.listDataset decodes by name with the exported Marketplace ABI.
//
// Usage: node scripts/verify-deploy.mjs [--file <deployments.json>] [--keep <chainKey>]... [--differs-from <address>]
//   RPC_URL  default http://127.0.0.1:8545
//   --file   default ../web/src/contracts/deployments.json (relative to this script); a given path resolves from the cwd
//   --keep   a chain key that must still be in the file (repeatable); proves a redeploy merged instead of overwriting
//   --differs-from  an earlier Marketplace address; the file's Marketplace address must differ (proves a redeploy happened)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, http, getAddress } from "viem";

const here = path.dirname(fileURLToPath(import.meta.url));
const rpcUrl = process.env.RPC_URL ?? "http://127.0.0.1:8545";

function fail(message) {
  console.log("DEPLOY CHECK FAILED: " + message);
  process.exit(1);
}

function argValues(flag) {
  const out = [];
  const args = process.argv;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag) {
      if (i + 1 >= args.length) fail(`${flag} needs a value`);
      out.push(args[i + 1]);
    }
  }
  return out;
}

// walk the cause chain the way web/src/lib/tx-errors.ts does and return the first data.errorName
function findErrorName(err) {
  let cur = err;
  for (let depth = 0; cur && depth < 12; depth++) {
    if (cur.data && typeof cur.data.errorName === "string") return cur.data.errorName;
    cur = cur.cause;
  }
  return undefined;
}

function errorNames(abi) {
  return abi.filter((i) => i.type === "error").map((i) => i.name);
}
function functionNames(abi) {
  return abi.filter((i) => i.type === "function").map((i) => i.name);
}

async function main() {
  const fileArg = argValues("--file")[0];
  const file = fileArg ? path.resolve(fileArg) : path.resolve(here, "..", "..", "web", "src", "contracts", "deployments.json");
  const keepKeys = argValues("--keep");
  const differsFrom = argValues("--differs-from")[0];

  const client = createPublicClient({ transport: http(rpcUrl) });

  // a. chain id and entry
  const chainId = await client.getChainId().catch(() => {
    throw new Error(`No node answers at ${rpcUrl}`);
  });
  const key = String(chainId);
  if (!fs.existsSync(file)) throw new Error(`deployments file not found: ${file}`);
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  const entry = json[key];
  if (!entry) throw new Error(`no entry for chain ${key} in ${file}`);

  // b. shape
  if (entry.chainId !== chainId) throw new Error(`entry.chainId ${entry.chainId} does not match the node's chain id ${chainId}`);
  for (const name of ["DatasetRegistry", "Marketplace"]) {
    const c = entry[name];
    if (!c || typeof c.address !== "string") throw new Error(`${name}.address missing`);
    if (c.address !== getAddress(c.address)) throw new Error(`${name}.address is not EIP-55 checksummed: ${c.address}`);
    if (!Array.isArray(c.abi) || c.abi.length === 0) throw new Error(`${name}.abi is empty`);
  }
  const head = await client.getBlockNumber();
  if (!Number.isInteger(entry.deployBlock) || entry.deployBlock <= 0 || BigInt(entry.deployBlock) > head) {
    throw new Error(`deployBlock ${entry.deployBlock} is not a positive block at or below the node's block ${head}`);
  }
  if (typeof entry.anomalyThresholdCents !== "string" || !/^\d+$/.test(entry.anomalyThresholdCents)) {
    throw new Error(`anomalyThresholdCents must be a string of digits, got ${JSON.stringify(entry.anomalyThresholdCents)}`);
  }

  const registry = { address: entry.DatasetRegistry.address, abi: entry.DatasetRegistry.abi };
  const market = { address: entry.Marketplace.address, abi: entry.Marketplace.abi };

  // c. bytecode
  for (const [name, c] of [["DatasetRegistry", registry], ["Marketplace", market]]) {
    const code = await client.getCode({ address: c.address });
    if (!code || code === "0x") throw new Error(`no bytecode at ${name} ${c.address}`);
  }

  // d. link and constants, through the exported ABIs only
  const linkedMarket = await client.readContract({ ...registry, functionName: "marketplace" });
  if (linkedMarket !== market.address) throw new Error(`registry.marketplace() is ${linkedMarket}, expected ${market.address}`);
  const linkedRegistry = await client.readContract({ ...market, functionName: "registry" });
  if (linkedRegistry !== registry.address) throw new Error(`market.registry() is ${linkedRegistry}, expected ${registry.address}`);
  const threshold = await client.readContract({ ...registry, functionName: "anomalyThresholdCents" });
  if (threshold !== BigInt(entry.anomalyThresholdCents)) throw new Error(`anomalyThresholdCents on chain is ${threshold}, file says ${entry.anomalyThresholdCents}`);
  const minBills = Number(await client.readContract({ ...registry, functionName: "MIN_BILLS_TO_LIST" }));
  if (minBills !== 3) throw new Error(`MIN_BILLS_TO_LIST is ${minBills}, expected 3`);
  const numCats = Number(await client.readContract({ ...registry, functionName: "NUM_CATEGORIES" }));
  if (numCats !== 6) throw new Error(`NUM_CATEGORIES is ${numCats}, expected 6`);

  // e. error names and function names the web app will use
  const marketErrors = errorNames(market.abi);
  for (const n of ["AlreadyPurchased", "OwnListing", "PriceChanged", "WrongPayment", "ListingNotFound", "NothingToWithdraw", "ZeroPrice", "InvalidTitle",
                   "TooFewBills", "DatasetIsSealed", "NotDatasetOwner", "DatasetNotFound"]) {
    if (!marketErrors.includes(n)) throw new Error(`Marketplace ABI lacks error ${n}`);
  }
  const regFns = functionNames(registry.abi);
  for (const n of ["createDataset", "addRecord", "getAggregates", "getBillHandles"]) {
    if (!regFns.includes(n)) throw new Error(`DatasetRegistry ABI lacks function ${n}`);
  }
  const marketFns = functionNames(market.abi);
  for (const n of ["listDataset", "buyListing", "withdraw", "getListings"]) {
    if (!marketFns.includes(n)) throw new Error(`Marketplace ABI lacks function ${n}`);
  }

  // f. a registry error bubbling through the Marketplace decodes by name (eth_call only, no state change)
  const accounts = await client.request({ method: "eth_accounts" });
  if (!accounts || accounts.length === 0) throw new Error("the node has no unlocked account for the decode check");
  let decoded;
  try {
    await client.simulateContract({
      address: market.address,
      abi: market.abi,
      functionName: "listDataset",
      args: [999999999n, "verify", "", 1n, 0],
      account: getAddress(accounts[0]),
    });
  } catch (err) {
    decoded = findErrorName(err);
    if (decoded !== "DatasetNotFound") throw new Error(`listDataset on a missing dataset decoded as ${decoded ?? "no error name"}, expected DatasetNotFound`);
  }
  if (decoded === undefined) throw new Error("listDataset on a missing dataset did not revert");

  // g. the sibling TypeScript file
  const tsFile = path.join(path.dirname(file), "deployments.ts");
  if (!fs.existsSync(tsFile)) throw new Error(`missing ${tsFile}`);
  const ts = fs.readFileSync(tsFile, "utf8");
  if (!ts.split(/\r?\n/)[0].startsWith("// GENERATED by contracts/scripts/deploy.mjs")) throw new Error("deployments.ts lacks the GENERATED header");
  if (!ts.includes("as const;")) throw new Error("deployments.ts lacks `as const;`");
  for (const k of Object.keys(json)) {
    if (!ts.includes(`"${k}": {`)) throw new Error(`deployments.ts lacks chain ${k}`);
  }
  if (!ts.includes(registry.address) || !ts.includes(market.address)) throw new Error("deployments.ts lacks the deployed addresses");

  // h. chains that must survive a redeploy
  for (const k of keepKeys) {
    if (!(k in json)) throw new Error(`chain ${k} was dropped from ${file}`);
    console.log(`kept chain ${k}`);
  }

  // i. a redeploy moved the Marketplace
  if (differsFrom) {
    const old = getAddress(differsFrom);
    if (old === market.address) throw new Error("Marketplace address did not change");
    console.log(`redeploy moved Marketplace from ${old} to ${market.address}`);
  }

  // j.
  console.log(`DEPLOY VERIFIED chain=${key} registry=${registry.address} market=${market.address} deployBlock=${entry.deployBlock}`);
}

try {
  await main();
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
}
