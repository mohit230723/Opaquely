// Phase 4 proof (tracer): the seller pipeline against a REAL hardhat node with the contracts deployed
// (node contracts/scripts/dev-node.mjs start; npm --prefix contracts run deploy).
// Create dataset -> under-filled listing is blocked -> three bills typed by hand, each encrypted in the
// browser and added in one wallet-signed tx -> chain-vs-you panel -> list -> sealed. Then assert on chain
// with viem and an SDK decrypt, and check that no plaintext left the browser. OCR arrives in Plans
// 04-02 and 04-03, which switch two of these bills to the sample buttons.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, getAddress, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat as viemHardhat } from "viem/chains";
import { createConfig } from "@zama-fhe/sdk/viem";
import { ZamaSDK, cleartext, memoryStorage } from "@zama-fhe/sdk";
import { hardhat } from "@zama-fhe/sdk/chains";

const RPC = "http://127.0.0.1:8545";
const T = { timeout: 30_000 };
const here = path.dirname(fileURLToPath(import.meta.url));
const deployments = JSON.parse(fs.readFileSync(path.resolve(here, "../src/contracts/deployments.json"), "utf8"))["31337"];
const PLAINTEXT_MARKERS = [
  "SHREE GANESH",
  "Bright Power",
  "Corner Kirana",
  "1507.80",
  "1,507.80",
  "3322.40",
  "3,322.40",
  "2,500.00",
  "iVBORw0KGgo",
];

export default async function sellerLive({ baseUrl, accounts, assert, waitForWallet, newPage }) {
  const up = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
  }).then((r) => r.ok, () => false);
  if (!up) throw new Error("no hardhat node on " + RPC);

  const page = await newPage({ account: accounts.seller, roles: { [accounts.seller]: "seller" }, rpcUrl: RPC, data: "chain" });
  const outgoing = []; // every request body and URL that left the page, to scan for plaintext
  const posts = []; // every POST target
  const rpcMethods = new Set();
  const consoleLines = [];
  page.on("request", (r) => {
    outgoing.push(r.url() + " " + (r.postData() ?? ""));
    if (r.method() === "POST") posts.push(r.url());
    if (r.method() === "POST" && r.url().startsWith(RPC)) {
      try {
        const body = JSON.parse(r.postData() ?? "[]");
        for (const m of Array.isArray(body) ? body : [body]) rpcMethods.add(m.method);
      } catch {
        /* not JSON */
      }
    }
  });
  page.on("console", (m) => consoleLines.push(m.text()));

  // ---- create a dataset on chain ----
  await page.goto(baseUrl + "/sell/datasets/new");
  await waitForWallet(page, accounts.seller);
  await page.getByLabel("Dataset name").fill("October household bills");
  await page.getByRole("button", { name: "Create dataset" }).click();
  await page.getByText("Dataset created.").waitFor(T);
  await page.getByRole("link", { name: "Add your first bill" }).click();
  await page.getByRole("heading", { name: "Add a bill" }).waitFor(T);
  const datasetId = new URL(page.url()).pathname.split("/")[3];
  assert(/^\d+$/.test(datasetId), "dataset id from the chain log must be numeric, got " + datasetId);

  // ---- MKT-01: an empty dataset cannot be listed. A hard navigation is safe: the tab holds no bill yet. ----
  await page.goto(baseUrl + "/sell/datasets/" + datasetId + "/list");
  await waitForWallet(page, accounts.seller);
  await page.getByText("Add at least 3 bills before listing. This dataset has 0.").waitFor(T);
  assert(
    (await page.getByRole("button", { name: "List dataset", exact: true }).count()) === 0,
    "no List dataset action under the minimum",
  );
  await page.goto(baseUrl + "/sell/datasets/" + datasetId + "/add");
  await waitForWallet(page, accounts.seller);
  await page.getByRole("heading", { name: "Add a bill" }).waitFor(T);

  async function addCurrentBill(expectCount) {
    await page.getByRole("button", { name: "Add bill to dataset" }).click();
    await page.getByText("Transaction confirmed").waitFor(T);
    await page.getByText(`Bill added. This dataset now has ${expectCount} bill`).waitFor(T);
  }

  // ---- bill 1: typed by hand ----
  await page.getByLabel("Vendor (optional)").fill("SHREE GANESH SUPER MART");
  await page.getByLabel("Total amount").fill("1,507.80");
  await page.getByLabel("Date").fill("2026-10-18");
  await page.getByRole("radio", { name: "Groceries/Food" }).click();
  await addCurrentBill(1);
  await page.getByRole("button", { name: "Add another bill" }).click();

  // ---- bill 2: typed by hand ----
  await page.getByLabel("Vendor (optional)").fill("Bright Power Distribution Co. Ltd.");
  await page.getByLabel("Total amount").fill("3,322.40");
  await page.getByLabel("Date").fill("2026-10-12");
  await page.getByRole("radio", { name: "Utilities" }).click();
  await addCurrentBill(2);
  await page.getByRole("button", { name: "Add another bill" }).click();

  // ---- bill 3: typed by hand ----
  await page.getByLabel("Vendor (optional)").fill("Corner Kirana");
  await page.getByLabel("Total amount").fill("2,500.00");
  await page.getByLabel("Date").fill("2026-10-20");
  await page.getByRole("radio", { name: "Shopping" }).click();
  await addCurrentBill(3);

  // ---- in-app navigation only from here until the listing is confirmed: a hard reload would clear the
  // tab-memory plaintext map, and the category mask is computed from it ----
  await page.getByRole("link", { name: "Back to dataset" }).click();
  await page.getByRole("link", { name: "Chain view" }).click();
  await page.getByRole("heading", { name: "Bill 3" }).waitFor(T);
  // The panel shows what was typed this session beside the real on-chain handles.
  const panel = await page.locator("main").innerText();
  assert(
    panel.includes("SHREE GANESH SUPER MART") && panel.includes("1,507.80") && panel.includes("Corner Kirana"),
    "panel must show the session values",
  );
  const handles = await page
    .locator('[title^="0x"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute("title") ?? "").filter((t) => /^0x[0-9a-f]{64}$/i.test(t)));
  assert(handles.length === 9, "expected 9 ciphertext handles, got " + handles.length);
  await page.goBack();

  // ---- list ----
  await page.getByRole("link", { name: "List dataset" }).click();
  await page.getByLabel("Title").fill("October household insights");
  await page.getByLabel("Description").fill("Three household bills from October 2026.");
  await page.getByLabel("Price (ETH)").fill("0.05");
  await page.getByRole("button", { name: "List dataset", exact: true }).click();
  await page.getByText("The listing also shows buyers which categories these bills cover").waitFor(T);
  await page.getByRole("button", { name: "Seal and list dataset" }).click();
  await page.getByText("Transaction confirmed").waitFor(T);

  // ---- the datasets list shows it listed, and a sealed dataset takes no more bills ----
  await page.getByRole("button", { name: "View my datasets" }).click();
  await page.waitForURL((u) => u.pathname === "/sell/datasets", { timeout: 15_000 });
  const row = page.locator("tr", { hasText: "October household bills" });
  await row.getByText("Listed").waitFor(T);
  const rowText = await row.innerText();
  assert(rowText.includes("Listed") && /\b3\b/.test(rowText), "datasets row must show Listed and 3 bills: " + rowText);
  assert((await row.getByRole("link", { name: "Add bill" }).count()) === 0, "a listed dataset must not offer Add bill");
  await page.goto(baseUrl + "/sell/datasets/" + datasetId + "/add");
  await waitForWallet(page, accounts.seller);
  await page.getByRole("heading", { name: "This dataset is sealed" }).waitFor(T);

  // ---- chain assertions (Node, viem) ----
  const reg = deployments.DatasetRegistry;
  const mkt = deployments.Marketplace;
  const pc = createPublicClient({ chain: viemHardhat, transport: http(RPC) });
  const seller = getAddress(accounts.seller);
  const rows = await pc.readContract({ address: reg.address, abi: reg.abi, functionName: "datasetsByOwner", args: [seller] });
  const mine = rows.find((r) => r.id.toString() === datasetId);
  assert(
    mine && mine.recordCount === 3 && mine.isSealed === true,
    "dataset must have 3 bills and be sealed: " + JSON.stringify(mine, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
  );
  const listingId = await pc.readContract({ address: mkt.address, abi: mkt.abi, functionName: "listingOfDataset", args: [BigInt(datasetId)] });
  assert(listingId > 0n, "dataset must be listed");
  const listing = await pc.readContract({ address: mkt.address, abi: mkt.abi, functionName: "getListing", args: [listingId] });
  assert(listing.priceWei === 50_000_000_000_000_000n && listing.title === "October household insights", "listing fields");
  // groceries (1), utilities (0) and shopping (4) were typed in this tab: bits 0, 1 and 4
  assert(listing.categoryMask === 0b010011, "declared category mask, got " + listing.categoryMask);

  const chain = {
    ...hardhat,
    network: RPC,
    gatewayChainId: 100733346448153,
    verifyingContractAddressDecryption: "0xEaaA2FC6BC259dF015Aa7Dc8e59e0B67df622721",
    verifyingContractAddressInputVerification: "0x6189F6c0c3E40B4a3c72ec86262295D78d845297",
    inputSignerPrivateKey: "0xcae2ef860129ace577171fcfd131fe77bf849460f05b0b128ecfb75b53541ecc",
    kmsSignerPrivateKey: "0x0000000000000000000000000000000000000000000000000000000000000001",
  };
  // Hardhat dev account #0 (public test key), the seller: it is allowed to decrypt its own aggregates.
  const wc = createWalletClient({
    account: privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"),
    chain: viemHardhat,
    transport: http(RPC),
  });
  const sdk = new ZamaSDK(
    createConfig({ chains: [chain], publicClient: pc, walletClient: wc, storage: memoryStorage, relayers: { [hardhat.id]: cleartext() } }),
  );
  const agg = await pc.readContract({ address: reg.address, abi: reg.abi, functionName: "getAggregates", args: [BigInt(datasetId)], account: seller });
  const dec = await sdk.decryption.decryptValues([{ encryptedValue: agg[1], contractAddress: getAddress(reg.address) }]);
  sdk.terminate();
  assert(dec[agg[1]] === 150780n + 332240n + 250000n, "decrypted grand total must be the three bills, got " + String(dec[agg[1]]));

  // ---- privacy (amounts are in calldata under the local cleartext mock, so only vendor, image and amount text are scanned) ----
  const rpcOrigin = new URL(RPC).origin;
  const badPost = posts.filter((u) => !u.startsWith(rpcOrigin) && !u.startsWith("https://pulse.walletconnect.org"));
  assert(badPost.length === 0, "POST to a non-RPC host: " + badPost.join(" | "));
  const leaked = outgoing.filter((o) => PLAINTEXT_MARKERS.some((m) => o.includes(m)));
  assert(leaked.length === 0, "plaintext marker in an outgoing request: " + leaked.map((l) => l.slice(0, 160)).join(" | "));
  const logged = consoleLines.filter((l) => PLAINTEXT_MARKERS.some((m) => l.includes(m)));
  assert(logged.length === 0, "plaintext marker in the console: " + logged.join(" | "));
  const keys = await page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)]);
  assert(
    keys.every((k) => k.startsWith("opaquely:role:") || /^(wagmi|rk-|@appkit|base-acc-sdk|WALLETCONNECT|wc@)/i.test(k)),
    "unexpected storage keys: " + keys.join(","),
  );
  const dbs = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
  assert(!dbs.includes("keyval-store"), "unexpected IndexedDB: " + dbs.join(","));
  console.log("  LIVE SELLER OK dataset=" + datasetId + " listing=" + listingId + " mask=" + listing.categoryMask + " rpc=" + [...rpcMethods].sort().join(","));
}
