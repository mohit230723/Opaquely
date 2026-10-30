// Phase 4 proof (tracer), on the Phase 7 Upload page: the seller pipeline against a REAL hardhat node with the
// contracts deployed (node contracts/scripts/dev-node.mjs start; npm --prefix contracts run deploy).
// /upload: describe -> List to Marketplace is blocked under the minimum -> two bills read by browser OCR from the
// bundled sample photos and one typed by hand, each encrypted in the browser with Encrypt (the first Encrypt
// creates the dataset; its id is read from the chain) -> the chain rows under Encrypted bills -> List to
// Marketplace -> sealed, and My Datasets shows it Listed. Then assert on chain with viem and an SDK decrypt, and
// audit everything that left the page (image bytes, OCR-only text, vendors, amount text, POST targets, CDN
// attempts, storage, IndexedDB). No role anywhere; every lookup is scoped to header, main or a dialog.
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
  // OCR-only text: the receipt lines the form never shows (RESEARCH Pitfall 8 / T-04-14)
  "GSTIN 27ABCDE1234F1Z5",
  "CASH TENDERED",
  "Consumer No",
  "1002938475",
  "Plot 14, MG Road",
  "Thank you, visit again",
];

export default async function sellerLive({ baseUrl, accounts, assert, waitForWallet, newPage }) {
  const up = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
  }).then((r) => r.ok, () => false);
  if (!up) throw new Error("no hardhat node on " + RPC);

  const page = await newPage({ account: accounts.seller, rpcUrl: RPC, data: "chain" });
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

  const tag = Date.now().toString(36);
  // The dataset name is also the listing title (Upload has no separate title field).
  const NAME = "October household " + tag;
  const reg = deployments.DatasetRegistry;
  const mkt = deployments.Marketplace;
  const pc = createPublicClient({ chain: viemHardhat, transport: http(RPC) });
  const seller = getAddress(accounts.seller);
  const main = page.locator("main");
  const primary = page.locator("header").getByRole("navigation", { name: "Primary" });
  const encryptedBills = main.locator("section", { has: page.getByRole("heading", { level: 2, name: "Encrypted bills" }) });
  const listButton = main.getByRole("button", { name: "List to Marketplace", exact: true });

  // ---- describe a new dataset on /upload (no role step: any wallet can upload) ----
  await page.goto(baseUrl + "/upload");
  await waitForWallet(page, accounts.seller);
  await main.getByRole("heading", { level: 2, name: "Describe your dataset" }).waitFor(T);
  // The first Encrypt creates the dataset, so its id is the one id datasetsByOwner gains (never from the URL).
  const idsBefore = new Set(
    (await pc.readContract({ address: reg.address, abi: reg.abi, functionName: "datasetsByOwner", args: [seller] })).map((r) =>
      r.id.toString(),
    ),
  );
  await main.getByLabel("Dataset name").fill(NAME);
  await main.getByLabel("Description").fill("Three household bills from October 2026.");
  // The banner is honest about the local mock: the node sees amount, date and category in cleartext.
  await main.getByText("Local FHEVM mock: the image and the vendor stay in this browser").waitFor(T);

  // ---- MKT-01: a dataset under the minimum cannot be listed (the price is editable, the button is blocked) ----
  assert((await listButton.getAttribute("aria-disabled")) === "true", "List to Marketplace must be blocked before any bill");
  await main.getByText("Add at least 3 bills before listing. This dataset has 0.").waitFor(T);

  async function encryptCurrentBill(expectCount) {
    await main.getByRole("button", { name: "Encrypt", exact: true }).click();
    // The first Encrypt signs twice (create the dataset, then record the bill).
    await main.getByText(`Bill encrypted. This dataset has ${expectCount} bill`).waitFor({ timeout: expectCount === 1 ? 60_000 : 30_000 });
    await main.getByText("Transaction confirmed").waitFor(T);
  }

  // ---- bill 1: OCR from the Grocery sample (SELL-02, SELL-03) ----
  await main.getByRole("button", { name: "Grocery", exact: true }).click();
  await main.getByTestId("ocr-status").filter({ hasText: "Read the bill" }).waitFor({ timeout: 30_000 });
  assert((await main.getByLabel("Vendor (optional)").inputValue()) === "SHREE GANESH SUPER MART", "grocery vendor prefill");
  assert((await main.getByLabel("Total amount").inputValue()) === "1507.80", "grocery amount prefill");
  assert((await main.getByLabel("Date").inputValue()) === "2026-10-18", "grocery date prefill");
  assert(
    (await main.getByRole("radio", { name: "Groceries/Food" }).getAttribute("aria-checked")) === "true",
    "grocery category prefill",
  );
  await encryptCurrentBill(1);
  const fresh = (
    await pc.readContract({ address: reg.address, abi: reg.abi, functionName: "datasetsByOwner", args: [seller] })
  ).filter((r) => !idsBefore.has(r.id.toString()));
  assert(fresh.length === 1, "the first Encrypt must create exactly one dataset, got " + fresh.length);
  const datasetId = fresh[0].id.toString();
  assert(/^\d+$/.test(datasetId), "dataset id from the chain must be numeric, got " + datasetId);
  await main.getByRole("button", { name: "Add another bill" }).click();

  // ---- bill 2: OCR from the Electricity sample ----
  await main.getByRole("button", { name: "Electricity", exact: true }).click();
  await main.getByTestId("ocr-status").filter({ hasText: "Read the bill" }).waitFor({ timeout: 30_000 });
  await page.waitForFunction(() => document.querySelector('main input[name="amount"]')?.value === "3322.40", null, T);
  assert(
    (await main.getByLabel("Vendor (optional)").inputValue()) === "Bright Power Distribution Co. Ltd.",
    "electricity vendor prefill",
  );
  assert((await main.getByLabel("Date").inputValue()) === "2026-10-12", "electricity date prefill");
  assert(
    (await main.getByRole("radio", { name: "Utilities" }).getAttribute("aria-checked")) === "true",
    "electricity category prefill",
  );
  await encryptCurrentBill(2);

  // Still under the minimum at 2 bills: step 4 says so and List to Marketplace stays blocked.
  await main.getByText("Add at least 3 bills before listing. This dataset has 2.").waitFor(T);
  assert((await listButton.getAttribute("aria-disabled")) === "true", "List to Marketplace must stay blocked at 2 bills");
  await main.getByRole("button", { name: "Add another bill" }).click();

  // ---- bill 3: typed by hand (OCR only pre-fills, so manual entry always works: SELL-05) ----
  await main.getByLabel("Vendor (optional)").fill("Corner Kirana");
  await main.getByLabel("Total amount").fill("2,500.00");
  await main.getByLabel("Date").fill("2026-10-20");
  await main.getByRole("radio", { name: "Shopping" }).click();
  await encryptCurrentBill(3);

  // ---- no reload from here until the listing is confirmed: a hard reload would clear the tab-memory plaintext
  // map, and the category mask is computed from it. Step 3 (Encrypted bills) shows the chain rows on this page. ----
  await encryptedBills.getByRole("heading", { level: 3, name: "Bill 3" }).waitFor(T);
  // The rows show what was typed this session beside the real on-chain handles.
  const panel = await encryptedBills.innerText();
  assert(
    panel.includes("SHREE GANESH SUPER MART") &&
      panel.includes("1,507.80") &&
      panel.includes("Bright Power") &&
      panel.includes("Corner Kirana"),
    "the chain rows must show the session values",
  );
  assert(
    (await encryptedBills.getByText("Not available after reload").count()) === 0,
    "bills encrypted in this tab must show their values, not the after-reload note",
  );
  const handles = await encryptedBills
    .locator('[title^="0x"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute("title") ?? "").filter((t) => /^0x[0-9a-f]{64}$/i.test(t)));
  assert(handles.length === 9, "expected 9 ciphertext handles, got " + handles.length);

  // ---- list with List to Marketplace ----
  assert((await listButton.getAttribute("aria-disabled")) === null, "List to Marketplace must unlock at 3 bills");
  await main.getByLabel("Price (ETH)").fill("0.05");
  await listButton.click();
  const listDialog = page.getByRole("dialog");
  await listDialog.getByRole("heading", { name: `List "${NAME}"?` }).waitFor(T);
  // The tab holds all three bills, so the dialog names the categories buyers will see (WR-06).
  await listDialog.getByText("Buyers will see these categories: Utilities, Groceries/Food, Shopping.").waitFor(T);
  await listDialog.getByRole("button", { name: "List to Marketplace", exact: true }).click();
  await listDialog.getByText("Transaction confirmed").waitFor(T);
  await listDialog.getByText("Dataset listed for 0.05 ETH.").waitFor(T);
  await page.waitForURL((u) => u.pathname === "/marketplace", { timeout: 15_000 });

  // ---- My Datasets shows it listed with 3 bills and no Continue in Upload; a sealed dataset takes no more bills ----
  await primary.getByRole("link", { name: "My Datasets", exact: true }).click({ timeout: 25_000 });
  await page.waitForURL((u) => u.pathname === "/my-datasets", { timeout: 15_000 });
  const card = main.getByTestId("listed-dataset").filter({ has: page.getByRole("heading", { level: 3, name: NAME, exact: true }) });
  await card.getByText("Listed", { exact: true }).waitFor(T);
  const cardText = await card.innerText();
  assert(cardText.includes("Listed") && cardText.includes("3 bills"), "the dataset card must show Listed and 3 bills: " + cardText);
  assert((await card.getByRole("link", { name: "Continue in Upload" }).count()) === 0, "a listed dataset must not offer Continue in Upload");
  await page.goto(baseUrl + "/upload?dataset=" + datasetId);
  await waitForWallet(page, accounts.seller);
  await main.getByRole("heading", { name: "Dataset not found" }).waitFor(T);

  // ---- chain assertions (Node, viem) ----
  const rows = await pc.readContract({ address: reg.address, abi: reg.abi, functionName: "datasetsByOwner", args: [seller] });
  const mine = rows.find((r) => r.id.toString() === datasetId);
  assert(
    mine && mine.recordCount === 3 && mine.isSealed === true,
    "dataset must have 3 bills and be sealed: " + JSON.stringify(mine, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
  );
  const listingId = await pc.readContract({ address: mkt.address, abi: mkt.abi, functionName: "listingOfDataset", args: [BigInt(datasetId)] });
  assert(listingId > 0n, "dataset must be listed");
  const listing = await pc.readContract({ address: mkt.address, abi: mkt.abi, functionName: "getListing", args: [listingId] });
  assert(listing.priceWei === 50_000_000_000_000_000n && listing.title === NAME, "listing fields");
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
  // OCR assets are same-origin and never fetched from a CDN (the runner would abort a CDN request anyway).
  const tess = outgoing.map((o) => o.split(" ")[0]).filter((u) => u.includes("/tesseract/"));
  assert(tess.some((u) => u.endsWith("/tesseract/worker.min.js")), "worker.min.js must load from /tesseract");
  assert(tess.some((u) => /-lstm\.wasm\.js$/.test(u)), "an lstm core must load from /tesseract");
  assert(tess.some((u) => u.endsWith("/tesseract/lang/eng.traineddata.gz")), "eng model must load from /tesseract/lang");
  assert(!outgoing.some((o) => /jsdelivr|unpkg|cdn\./.test(o.split(" ")[0])), "no CDN request may be attempted");
  // Phase 7 removed the role: the app keeps no storage key of its own, only the wallet libraries do.
  const keys = await page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)]);
  assert(!keys.some((k) => /^opaquely/i.test(k)), "the app must keep no opaquely* storage key: " + keys.join(","));
  assert(
    keys.every((k) => /^(wagmi|rk-|@appkit|base-acc-sdk|WALLETCONNECT|wc@)/i.test(k)),
    "unexpected storage keys: " + keys.join(","),
  );
  const dbs = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
  assert(!dbs.includes("keyval-store"), "unexpected IndexedDB: " + dbs.join(","));
  console.log("  LIVE SELLER OK dataset=" + datasetId + " listing=" + listingId + " mask=" + listing.categoryMask + " ocr=2 rpc=" + [...rpcMethods].sort().join(","));
}
