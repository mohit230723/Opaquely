// The Friday demo as one continuous story against a REAL hardhat node with the contracts deployed. Normally
// run by scripts/demo-rehearse.mjs as the first script on a freshly started and freshly deployed chain.
// Phase 7 pages, no role anywhere: the seller (Hardhat #0) describes a dataset on /upload, reads the three
// bundled sample bills with browser OCR and presses Encrypt for each (the first Encrypt creates the dataset), then
// sets 0.05 ETH and presses List to Marketplace, landing on /marketplace. The buyer (Hardhat #1) finds the card on
// /marketplace, presses Buy this dataset, pays the exact price and sees Access granted. The seller's My Account
// (/account), left open, catches the sale by polling, and Withdraw moves exactly the pending ETH into the
// seller's wallet. The dataset id is read from the chain (the id datasetsByOwner gains), never from the URL.
// It compares chain deltas and finds its own data by a per-run tag, so it also passes on a used node.
// The same run is audited with helpers/privacy-audit.mjs: only the app, the node and two tolerated wallet hosts
// may be contacted, and no bill marker may appear in a request, console line, page error, buyer page text,
// storage value or IndexedDB record. The badge, its tooltip and the footer must say the local chain is a mock.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, formatEther, getAddress, http } from "viem";
import { hardhat as viemHardhat } from "viem/chains";
import { createPrivacyAudit } from "./helpers/privacy-audit.mjs";

const RPC = "http://127.0.0.1:8545";
const T = { timeout: 30_000 };
const PRICE = 50_000_000_000_000_000n;
const here = path.dirname(fileURLToPath(import.meta.url));
const deployments = JSON.parse(fs.readFileSync(path.resolve(here, "../src/contracts/deployments.json"), "utf8"))["31337"];

// Mirrors NETWORK_TOOLTIP and LOCAL_MOCK_NOTE in src/lib/network.ts (that file is TypeScript, so it is copied).
const NETWORK_TOOLTIP = "Transactions run on a local test chain. Encryption here is simulated, not real FHE.";
const LOCAL_MOCK_NOTE = "Local FHEVM mock: a local test chain. Encryption is simulated, not real FHE. Never enter a real bill.";

// What a leak would look like: vendors, the bill amounts as text, the PNG header in base64, and lines that only
// the OCR text holds (the review form never shows them).
const MARKERS = [
  "SHREE GANESH",
  "Bright Power",
  "CityCare",
  "1507.80",
  "1,507.80",
  "3322.40",
  "3,322.40",
  "8345.50",
  "8,345.50",
  "iVBORw0KGgo",
  "GSTIN 27ABCDE1234F1Z5",
  "CASH TENDERED",
  "Consumer No",
  "1002938475",
  "Plot 14, MG Road",
  "Thank you, visit again",
  "INV-20817",
  "Metformin",
  "Insulin Glargine",
  "Station Road",
];

/** Mirrors formatEth in src/lib/format.ts: at most 6 decimals, trailing zeros trimmed. */
function eth(wei) {
  const [whole, frac = ""] = formatEther(wei).split(".");
  const trimmed = frac.slice(0, 6).replace(/0+$/, "");
  return `${whole}${trimmed ? `.${trimmed}` : ""} ETH`;
}

// The three sample bills, in the order the seller reads them. Vendor is asserted where the OCR is exact.
const BILLS = [
  { button: "Grocery", vendor: "SHREE GANESH SUPER MART", amount: "1507.80", date: "2026-10-18", category: "Groceries/Food" },
  { button: "Electricity", vendor: "Bright Power Distribution Co. Ltd.", amount: "3322.40", date: "2026-10-12", category: "Utilities" },
  { button: "Pharmacy", vendor: null, amount: "8345.50", date: "2026-10-25", category: "Medical" },
];

export default async function demoRehearsal({ baseUrl, accounts, assert, waitForWallet, newPage }) {
  const up = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
  }).then((r) => r.ok, () => false);
  if (!up) throw new Error("no hardhat node on " + RPC);

  const chain = { ...viemHardhat, rpcUrls: { default: { http: [RPC] } } };
  const client = createPublicClient({ chain, transport: http(RPC) });
  const reg = deployments.DatasetRegistry;
  const mkt = deployments.Marketplace;
  const read = (c, functionName, args) => client.readContract({ address: c.address, abi: c.abi, functionName, args });
  const eventAbi = (name) => mkt.abi.find((x) => x.type === "event" && x.name === name);
  const logsOf = (name) =>
    client.getLogs({ address: mkt.address, event: eventAbi(name), fromBlock: BigInt(deployments.deployBlock), toBlock: "latest" });
  const purchasedFor = async (listingId, buyer) =>
    (await logsOf("Purchased")).filter(
      (l) => l.args.listingId === BigInt(listingId) && l.args.buyer.toLowerCase() === buyer.toLowerCase(),
    );
  const exactCount = (page, text) => page.getByText(text, { exact: true }).count();
  const statWait = (page, caption, expected, timeout = T.timeout) =>
    page.waitForFunction(
      ([c, e]) => {
        const p = [...document.querySelectorAll("p")].find((x) => x.textContent === c);
        return p?.parentElement?.querySelector("p.tabular-nums")?.textContent === e;
      },
      [caption, expected],
      { timeout },
    );
  const audit = createPrivacyAudit({ baseUrl, rpcUrl: RPC, markers: MARKERS });
  /**
   * On a deployed node the stale-deployment banner must be absent (T-06-14). The guard shows nothing while its
   * code read is pending, so first wait until it reports data-status="ok" (both reads succeeded and found code),
   * then check the banner stays away for a short window.
   */
  const assertNoStaleBanner = async (page, where) => {
    await page.locator('[data-testid="deployment-guarded"][data-status="ok"]').waitFor(T);
    await page.waitForTimeout(500);
    assert((await page.getByText("The contracts are not on this chain").count()) === 0, `${where}: no stale-deployment banner on a deployed node`);
  };
  /** The header badge, its tooltip and the footer all say the local chain is a mock (T-06-05). */
  const assertHonest = async (page, where) => {
    const badge = page.getByTestId("network-badge");
    await badge.waitFor(T);
    assert((await badge.innerText()).includes("Local FHEVM mock"), `${where}: the badge must read Local FHEVM mock`);
    assert((await badge.getAttribute("title")) === NETWORK_TOOLTIP, `${where}: the badge tooltip must be the mock tooltip`);
    assert((await page.locator("footer").innerText()).includes(LOCAL_MOCK_NOTE), `${where}: the footer must say the local chain is a mock`);
  };
  const seller = getAddress(accounts.seller);
  const buyer = getAddress(accounts.buyer);

  // ---- (a) chain counters before anything happens, and the per-run tag ----
  const tag = Date.now().toString(36);
  // The dataset name is also the listing title.
  const NAME = "Rehearsal " + tag;
  const statsBefore = await read(mkt, "sellerStats", [seller]); // [listings, sales, withdrawableWei]

  // ---- (b) seller page S: describe the dataset on /upload (no role step: any wallet can upload) ----
  const S = await newPage({ account: accounts.seller, rpcUrl: RPC, data: "chain" });
  await audit.track(S, "seller");
  await S.goto(baseUrl + "/upload");
  await waitForWallet(S, accounts.seller);
  const SM = S.locator("main");
  const sPrimary = S.locator("header").getByRole("navigation", { name: "Primary" });
  await SM.getByRole("heading", { level: 2, name: "Describe your dataset" }).waitFor(T);
  // The first Encrypt creates the dataset, so its id is the one id datasetsByOwner gains (never from the URL).
  const idsBefore = new Set((await read(reg, "datasetsByOwner", [seller])).map((r) => r.id.toString()));
  await SM.getByLabel("Dataset name").fill(NAME);
  await SM.getByLabel("Description").fill("Cold-start rehearsal.");
  await SM.getByText("Local FHEVM mock: the image and the vendor stay in this browser").waitFor(T);

  // ---- (c) three bills by OCR, each through Encrypt (the first one signs twice: create, then record) ----
  let datasetId = null;
  for (let i = 0; i < BILLS.length; i++) {
    const b = BILLS[i];
    await SM.getByRole("button", { name: b.button, exact: true }).click();
    await SM.getByTestId("ocr-status").filter({ hasText: "Read the bill" }).waitFor({ timeout: 30_000 });
    await S.waitForFunction((v) => document.querySelector('main input[name="amount"]')?.value === v, b.amount, T);
    assert((await SM.getByLabel("Date").inputValue()) === b.date, `${b.button} date prefill`);
    assert(
      (await SM.getByRole("radio", { name: b.category }).getAttribute("aria-checked")) === "true",
      `${b.button} category prefill (${b.category})`,
    );
    if (b.vendor) assert((await SM.getByLabel("Vendor (optional)").inputValue()) === b.vendor, `${b.button} vendor prefill`);
    await SM.getByRole("button", { name: "Encrypt", exact: true }).click();
    await SM.getByText(`Bill encrypted. This dataset has ${i + 1} bill`).waitFor({ timeout: i === 0 ? 60_000 : 30_000 });
    await SM.getByText("Transaction confirmed").waitFor(T);
    if (i === 0) {
      const fresh = (await read(reg, "datasetsByOwner", [seller])).filter((r) => !idsBefore.has(r.id.toString()));
      assert(fresh.length === 1, "the first Encrypt must create exactly one dataset, got " + fresh.length);
      datasetId = fresh[0].id.toString();
      assert(/^\d+$/.test(datasetId), "dataset id from the chain must be numeric, got " + datasetId);
    }
    if (i < BILLS.length - 1) await SM.getByRole("button", { name: "Add another bill" }).click();
  }

  // ---- (d) list on the same page: no reload until the listing confirms (the category mask comes from tab memory) ----
  await SM.getByLabel("Price (ETH)").fill("0.05");
  await SM.getByRole("button", { name: "List to Marketplace", exact: true }).click();
  const listDialog = S.getByRole("dialog");
  await listDialog.getByRole("heading", { name: `List "${NAME}"?` }).waitFor(T);
  const disclosure = listDialog.getByTestId("categories-disclosure");
  await disclosure.waitFor(T);
  const disclosureText = await disclosure.innerText();
  for (const label of ["Utilities", "Groceries/Food", "Medical"]) {
    assert(disclosureText.includes(label), `the list dialog must name ${label}, got: ${disclosureText}`);
  }
  await listDialog.getByRole("button", { name: "List to Marketplace", exact: true }).click();
  await listDialog.getByText("Transaction confirmed").waitFor(T);
  await listDialog.getByText("Dataset listed for 0.05 ETH.").waitFor(T);
  await S.waitForURL((u) => u.pathname === "/marketplace", { timeout: 15_000 });
  const listingId = await read(mkt, "listingOfDataset", [BigInt(datasetId)]);
  assert(listingId > 0n, "the dataset must be listed");
  const listing = await read(mkt, "getListing", [listingId]);
  assert(listing.title === NAME, "listing title (the dataset name), got " + listing.title);
  assert(listing.priceWei === PRICE, "listing price, got " + listing.priceWei);
  assert(listing.recordCount === 3, "listing record count, got " + listing.recordCount);
  assert(listing.categoryMask === 7, "declared category mask must be 7 (Utilities, Groceries/Food, Medical), got " + listing.categoryMask);
  const dataset = (await read(reg, "datasetsByOwner", [seller])).find((r) => r.id.toString() === datasetId);
  assert(dataset && dataset.recordCount === 3 && dataset.isSealed === true, "the dataset must hold 3 bills and be sealed");

  // ---- (e) seller's My Account, left open to prove polling ----
  await sPrimary.getByRole("link", { name: "My Account", exact: true }).click({ timeout: 25_000 });
  await S.waitForURL((u) => u.pathname === "/account", { timeout: 15_000 });
  await SM.getByText("Withdrawable balance", { exact: true }).waitFor(T);
  await statWait(S, "Purchases of your listings", String(statsBefore[1]));
  await assertHonest(S, "seller /account");
  await assertNoStaleBanner(S, "seller /account");

  // ---- (f) buyer page B: find the card on /marketplace, buy from it, access ----
  const B = await newPage({ account: accounts.buyer, rpcUrl: RPC, data: "chain" });
  await audit.track(B, "buyer", { bodyText: true });
  await B.goto(baseUrl + "/marketplace");
  await waitForWallet(B, accounts.buyer);
  const card = B.locator("main")
    .locator('li[data-testid="listing-card"]')
    .filter({ has: B.getByRole("link", { name: NAME, exact: true }) });
  await card.waitFor(T);
  await assertHonest(B, "buyer /marketplace");
  await assertNoStaleBanner(B, "buyer /marketplace");
  await audit.snapshotBody(B, "buyer on /marketplace");
  const cardText = await card.innerText();
  for (const s of ["0.05 ETH", "3 bills", "Utilities", "Groceries/Food", "Medical"]) {
    assert(cardText.includes(s), `the listing card must show "${s}", got: ${cardText}`);
  }
  await card.getByRole("button", { name: "Buy this dataset" }).click({ timeout: 25_000 });
  const dialog = B.getByRole("dialog", { name: "Confirm purchase" });
  await dialog.waitFor(T);
  const statsPreBuy = await read(mkt, "sellerStats", [seller]);
  await dialog.getByRole("button", { name: "Pay 0.05 ETH" }).click();
  await dialog.getByText("Transaction confirmed").waitFor(T);
  await dialog.getByText("Access granted.", { exact: true }).waitFor(T);
  const bought = await purchasedFor(listingId, buyer);
  assert(bought.length === 1, "exactly one Purchased event for the buyer and the listing, got " + bought.length);
  const buyHash = bought[0].transactionHash;
  assert((await read(mkt, "hasAccess", [listingId, buyer])) === true, "chain: the buyer must have access");
  assert((await read(mkt, "hasAccess", [listingId, seller])) === false, "chain: the seller has no purchase access to its own listing");
  await B.goto(baseUrl + "/marketplace/" + listingId);
  await waitForWallet(B, accounts.buyer);
  await B.getByRole("heading", { level: 1, name: NAME }).waitFor(T);
  await B.locator("main").getByText("Access granted", { exact: true }).waitFor(T);
  assert((await exactCount(B.locator("main"), "Access granted")) === 1, "the detail page must show the Access granted chip");
  await audit.snapshotBody(B, "buyer on the listing after access");
  const decrypt = B.locator("main").getByRole("button", { name: "Decrypt insights (coming in M2)" });
  assert((await decrypt.getAttribute("aria-disabled")) === "true", "the decrypt button must be disabled");

  // ---- (g) polling proof: the open dashboard catches the sale with no navigation ----
  await S.bringToFront();
  await statWait(S, "Purchases of your listings", String(statsPreBuy[1] + 1n), 15_000);
  const pending = (await read(mkt, "sellerStats", [seller]))[2];
  assert(pending === statsPreBuy[2] + PRICE, `withdrawable ${pending} must be ${statsPreBuy[2]} (read before the buy) + the price ${PRICE}`);
  await statWait(S, "Held until withdrawn", eth(pending), 15_000);

  // ---- (h) withdraw: exactly the pending ETH reaches the seller's wallet ----
  const bal0 = await client.getBalance({ address: seller });
  const blockBeforeWithdraw = await client.getBlockNumber();
  await S.getByRole("button", { name: "Withdraw balance" }).click();
  await S.getByText("Transaction confirmed").waitFor(T);
  await S.getByText("Nothing to withdraw yet.").waitFor(T);
  await statWait(S, "Held until withdrawn", "0 ETH");
  assert((await read(mkt, "sellerStats", [seller]))[2] === 0n, "chain: nothing left to withdraw");
  const withdrawn = (await logsOf("Withdrawn")).filter(
    (l) => l.args.seller.toLowerCase() === seller.toLowerCase() && l.blockNumber > blockBeforeWithdraw,
  );
  assert(withdrawn.length >= 1, "no Withdrawn event for the seller after the withdraw click");
  const amount = withdrawn[0].args.amountWei;
  assert(amount === pending, `Withdrawn amount ${amount} must equal the pending ${pending}`);
  const receipt = await client.getTransactionReceipt({ hash: withdrawn[0].transactionHash });
  const bal1 = await client.getBalance({ address: seller });
  assert(
    bal1 - bal0 + receipt.gasUsed * receipt.effectiveGasPrice === pending,
    `balance identity: delta ${bal1 - bal0} + gas ${receipt.gasUsed * receipt.effectiveGasPrice} must equal ${pending}`,
  );

  // ---- (i) the audit, over both pages ----
  await audit.snapshotBody(B, "buyer at the end");
  const { requests, origins } = await audit.assertClean();

  console.log(
    `  DEMO PATH OK dataset=${datasetId} listing=${listingId} mask=7 ocr=3 buy=${buyHash.slice(0, 10)} withdrawn=${pending} audit=clean stale=none requests=${requests} origins=${origins.join(",")}`,
  );
}
