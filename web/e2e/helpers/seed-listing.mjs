// Test-only helper: seeds a real listing on the local Hardhat node the way a seller would (create dataset,
// three addRecord calls with one sdk.encrypt each under the local cleartext() chain override, listDataset).
// Used by buyer-live.e2e.mjs and runnable alone with `node web/e2e/helpers/seed-listing.mjs --self-check`.
// It lives under e2e/helpers/ so the runner, which only picks top-level *.e2e.mjs files, never runs it as a
// script. Importing the module seeds nothing; it refuses to send anything unless the RPC reports chain 31337.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, http, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat as viemHardhat } from "viem/chains";
import { createConfig } from "@zama-fhe/sdk/viem";
import { ZamaSDK, cleartext, memoryStorage } from "@zama-fhe/sdk";
import { hardhat } from "@zama-fhe/sdk/chains";

// Public Hardhat dev account #0 key, printed by every `hardhat node`, test-only. It is the same key
// fhe-spike.e2e.mjs and seller-live.e2e.mjs use. It is the only key here: nothing else signs.
const SELLER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

function clientsFor(rpc, key) {
  const chain = { ...viemHardhat, rpcUrls: { default: { http: [rpc] } } };
  const account = privateKeyToAccount(key);
  const publicClient = createPublicClient({ chain, transport: http(rpc) });
  const walletClient = createWalletClient({ account, chain, transport: http(rpc) });
  return { chain, account, publicClient, walletClient };
}

export async function seedListing({
  rpc,
  deployments,
  name = "Seed " + Date.now(),
  title = "Seeded household insights",
  description = "Three bills.",
  priceWei = 50_000_000_000_000_000n,
  categories = [0, 1, 4],
  bills,
}) {
  const reg = deployments.DatasetRegistry;
  const mkt = deployments.Marketplace;
  const { account, publicClient, walletClient } = clientsFor(rpc, SELLER_KEY);
  const chainId = await publicClient.getChainId();
  if (chainId !== 31337) {
    throw new Error(`seed-listing: refusing chain ${chainId}; it only seeds the local Hardhat node (31337)`);
  }
  const zChain = {
    ...hardhat,
    network: rpc,
    gatewayChainId: 100733346448153,
    verifyingContractAddressDecryption: "0xEaaA2FC6BC259dF015Aa7Dc8e59e0B67df622721",
    verifyingContractAddressInputVerification: "0x6189F6c0c3E40B4a3c72ec86262295D78d845297",
    inputSignerPrivateKey: "0xcae2ef860129ace577171fcfd131fe77bf849460f05b0b128ecfb75b53541ecc",
    kmsSignerPrivateKey: "0x0000000000000000000000000000000000000000000000000000000000000001",
  };
  const sdk = new ZamaSDK(
    createConfig({ chains: [zChain], publicClient, walletClient, storage: memoryStorage, relayers: { [hardhat.id]: cleartext() } }),
  );
  try {
    const send = async (c, functionName, args, value) => {
      const { request } = await publicClient.simulateContract({
        address: c.address, abi: c.abi, functionName, args, account, ...(value !== undefined ? { value } : {}),
      });
      const hash = await walletClient.writeContract(request);
      return publicClient.waitForTransactionReceipt({ hash });
    };
    await send(reg, "createDataset", [name]);
    const owned = await publicClient.readContract({ address: reg.address, abi: reg.abi, functionName: "datasetsByOwner", args: [account.address] });
    const datasetId = owned[owned.length - 1].id;
    const list = bills ?? [
      { c: 150780n, k: 1, d: 20379 },
      { c: 332240n, k: 0, d: 20373 },
      { c: 250000n, k: 4, d: 20381 },
    ];
    for (const b of list) {
      const enc = await sdk.encrypt({
        values: [
          { value: b.c, type: "euint64" },
          { value: BigInt(b.k), type: "euint8" },
          { value: BigInt(b.d), type: "euint32" },
        ],
        contractAddress: getAddress(reg.address),
        userAddress: getAddress(account.address),
      });
      const [a, k, d] = enc.encryptedValues;
      await send(reg, "addRecord", [datasetId, a, k, d, enc.inputProof]);
    }
    const mask = categories.reduce((m, c) => m | (1 << c), 0);
    const r = await send(mkt, "listDataset", [datasetId, title, description, priceWei, mask]);
    const listingId = await publicClient.readContract({ address: mkt.address, abi: mkt.abi, functionName: "listingOfDataset", args: [datasetId] });
    return { name, datasetId, listingId, priceWei, mask, gas: r.gasUsed };
  } finally {
    sdk.terminate();
  }
}

async function selfCheck() {
  const RPC = "http://127.0.0.1:8545";
  const here = path.dirname(fileURLToPath(import.meta.url));
  const deployments = JSON.parse(fs.readFileSync(path.resolve(here, "../../src/contracts/deployments.json"), "utf8"))["31337"];
  const BUYER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const t0 = Date.now();
  const tag = Date.now().toString(36);
  const a = await seedListing({ rpc: RPC, deployments, name: "Self-check A " + tag, title: "Self-check A " + tag, categories: [0, 1, 4], priceWei: 50_000_000_000_000_000n });
  const b = await seedListing({ rpc: RPC, deployments, name: "Self-check B " + tag, title: "Self-check B " + tag, categories: [], priceWei: 20_000_000_000_000_000n });
  const { account, publicClient } = clientsFor(RPC, SELLER_KEY);
  const mkt = deployments.Marketplace;
  const read = (functionName, args) => publicClient.readContract({ address: mkt.address, abi: mkt.abi, functionName, args });
  const expect = (cond, what) => {
    if (!cond) throw new Error("self-check mismatch: " + what);
  };
  for (const [seed, title, price, mask] of [
    [a, "Self-check A " + tag, 50_000_000_000_000_000n, 19],
    [b, "Self-check B " + tag, 20_000_000_000_000_000n, 0],
  ]) {
    const l = await read("getListing", [seed.listingId]);
    expect(l.title === title, "title " + l.title);
    expect(l.priceWei === price, "price " + l.priceWei);
    expect(Number(l.recordCount) === 3, "recordCount " + l.recordCount);
    expect(l.seller.toLowerCase() === account.address.toLowerCase(), "seller " + l.seller);
    expect(Number(l.categoryMask) === mask, `mask ${l.categoryMask} != ${mask}`);
  }
  expect((await read("hasAccess", [a.listingId, BUYER])) === false, "buyer must not have access yet");
  console.log(`SEED OK listing=${a.listingId} mask=${a.mask} listing=${b.listingId} mask=${b.mask} ms=${Date.now() - t0}`);
}

if (process.argv.includes("--self-check")) {
  selfCheck().then(
    () => process.exit(0),
    (err) => {
      console.log("SEED FAILED " + (err instanceof Error ? err.message : String(err)));
      process.exit(1);
    },
  );
}
