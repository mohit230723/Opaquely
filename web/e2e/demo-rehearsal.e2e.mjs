// The Friday demo as one continuous story against a REAL hardhat node with the contracts deployed. Normally
// run by scripts/demo-rehearse.mjs as the first script on a freshly started and freshly deployed chain.
// Seller (Hardhat #0) reads the three bundled sample bills with browser OCR, encrypts and adds each in a
// wallet-signed transaction, and lists the dataset. Buyer (Hardhat #1) finds it on /buy, pays the exact price
// and sees Access granted. The seller's dashboard, left open, catches the sale by polling, and Withdraw
// moves exactly the pending ETH into the seller's wallet.
// It compares chain deltas and finds its own data by a per-run tag, so it also passes on a used node.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, formatEther, getAddress, http } from "viem";
import { hardhat as viemHardhat } from "viem/chains";

const RPC = "http://127.0.0.1:8545";
const T = { timeout: 30_000 };
const PRICE = 50_000_000_000_000_000n;
const here = path.dirname(fileURLToPath(import.meta.url));
const deployments = JSON.parse(fs.readFileSync(path.resolve(here, "../src/contracts/deployments.json"), "utf8"))["31337"];

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
  const seller = getAddress(accounts.seller);
  const buyer = getAddress(accounts.buyer);

  // ---- (a) chain counters before anything happens, and the per-run tag ----
  const tag = Date.now().toString(36);
  const statsBefore = await read(mkt, "sellerStats", [seller]); // [listings, sales, withdrawableWei]

  // ---- (b) seller page S: create the dataset ----
  const S = await newPage({ account: accounts.seller, roles: { [accounts.seller]: "seller" }, rpcUrl: RPC, data: "chain" });
  await S.goto(baseUrl + "/sell/datasets/new");
  await waitForWallet(S, accounts.seller);
  await S.getByLabel("Dataset name").fill("Rehearsal " + tag);
  await S.getByRole("button", { name: "Create dataset" }).click();
  await S.getByText("Dataset created.").waitFor(T);
  await S.getByRole("link", { name: "Add your first bill" }).click();
  await S.getByRole("heading", { name: "Add a bill" }).waitFor(T);
  const datasetId = new URL(S.url()).pathname.split("/")[3];
  assert(/^\d+$/.test(datasetId), "dataset id from the chain log must be numeric, got " + datasetId);
  await S.getByText("Local FHEVM mock: the image and the vendor stay in this browser").waitFor(T);

  // ---- (c) three bills by OCR ----
  for (let i = 0; i < BILLS.length; i++) {
    const b = BILLS[i];
    await S.getByRole("button", { name: b.button }).click();
    await S.getByTestId("ocr-status").filter({ hasText: "Read the bill" }).waitFor({ timeout: 30_000 });
    await S.waitForFunction((v) => document.querySelector('input[name="amount"]')?.value === v, b.amount, T);
    assert((await S.getByLabel("Date").inputValue()) === b.date, `${b.button} date prefill`);
    assert(
      (await S.getByRole("radio", { name: b.category }).getAttribute("aria-checked")) === "true",
      `${b.button} category prefill (${b.category})`,
    );
    if (b.vendor) assert((await S.getByLabel("Vendor (optional)").inputValue()) === b.vendor, `${b.button} vendor prefill`);
    await S.getByRole("button", { name: "Add bill to dataset" }).click();
    await S.getByText("Transaction confirmed").waitFor(T);
    await S.getByText(`Bill added. This dataset now has ${i + 1} bill`).waitFor(T);
    if (i < BILLS.length - 1) await S.getByRole("button", { name: "Add another bill" }).click();
  }

  // ---- (d) list: in-app navigation only until the listing confirms (the category mask comes from tab memory) ----
  await S.getByRole("link", { name: "Back to dataset" }).click();
  await S.getByRole("link", { name: "List dataset" }).click();
  await S.getByLabel("Title").fill("Rehearsal market " + tag);
  await S.getByLabel("Description").fill("Cold-start rehearsal.");
  await S.getByLabel("Price (ETH)").fill("0.05");
  await S.getByRole("button", { name: "List dataset", exact: true }).click();
  const disclosure = S.getByTestId("categories-disclosure");
  await disclosure.waitFor(T);
  const disclosureText = await disclosure.innerText();
  for (const label of ["Utilities", "Groceries/Food", "Medical"]) {
    assert(disclosureText.includes(label), `the list dialog must name ${label}, got: ${disclosureText}`);
  }
  await S.getByRole("button", { name: "Seal and list dataset" }).click();
  await S.getByText("Transaction confirmed").waitFor(T);
  const listingId = await read(mkt, "listingOfDataset", [BigInt(datasetId)]);
  assert(listingId > 0n, "the dataset must be listed");
  const listing = await read(mkt, "getListing", [listingId]);
  assert(listing.title === "Rehearsal market " + tag, "listing title, got " + listing.title);
  assert(listing.priceWei === PRICE, "listing price, got " + listing.priceWei);
  assert(listing.recordCount === 3, "listing record count, got " + listing.recordCount);
  assert(listing.categoryMask === 7, "declared category mask must be 7 (Utilities, Groceries/Food, Medical), got " + listing.categoryMask);
  const dataset = (await read(reg, "datasetsByOwner", [seller])).find((r) => r.id.toString() === datasetId);
  assert(dataset && dataset.recordCount === 3 && dataset.isSealed === true, "the dataset must hold 3 bills and be sealed");

  // ---- (e) seller dashboard, left open to prove polling ----
  await S.goto(baseUrl + "/sell");
  await waitForWallet(S, accounts.seller);
  await S.getByText("Withdrawable balance", { exact: true }).waitFor(T);
  await statWait(S, "Purchases of your listings", String(statsBefore[1]));

  // ---- (f) buyer page B: find, buy, access ----
  const B = await newPage({ account: accounts.buyer, roles: { [accounts.buyer]: "buyer" }, rpcUrl: RPC, data: "chain" });
  await B.goto(baseUrl + "/buy");
  await waitForWallet(B, accounts.buyer);
  const card = B.getByRole("link", { name: "Rehearsal market " + tag });
  await card.waitFor(T);
  const cardText = await card.innerText();
  for (const s of ["0.05 ETH", "3 bills", "Utilities", "Groceries/Food", "Medical"]) {
    assert(cardText.includes(s), `the listing card must show "${s}", got: ${cardText}`);
  }
  await card.click();
  await B.getByRole("heading", { level: 1, name: "Rehearsal market " + tag }).waitFor(T);
  await B.getByRole("button", { name: "Buy dataset" }).click();
  const dialog = B.getByRole("dialog");
  await dialog.getByText("Confirm purchase").waitFor(T);
  const statsPreBuy = await read(mkt, "sellerStats", [seller]);
  await dialog.getByRole("button", { name: "Pay 0.05 ETH" }).click();
  await B.getByText("Transaction confirmed").waitFor(T);
  await B.getByText("Access granted.", { exact: true }).waitFor(T);
  const bought = await purchasedFor(listingId, buyer);
  assert(bought.length === 1, "exactly one Purchased event for the buyer and the listing, got " + bought.length);
  const buyHash = bought[0].transactionHash;
  assert((await read(mkt, "hasAccess", [listingId, buyer])) === true, "chain: the buyer must have access");
  assert((await read(mkt, "hasAccess", [listingId, seller])) === false, "chain: the seller has no purchase access to its own listing");
  await B.goto(baseUrl + "/buy/" + listingId);
  await waitForWallet(B, accounts.buyer);
  await B.getByText("Access granted", { exact: true }).waitFor(T);
  assert((await exactCount(B, "Access granted")) === 1, "the detail page must show the Access granted chip");
  const decrypt = B.getByRole("button", { name: "Decrypt insights (coming in M2)" });
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

  console.log(
    `  DEMO PATH OK dataset=${datasetId} listing=${listingId} mask=7 ocr=3 buy=${buyHash.slice(0, 10)} withdrawn=${pending}`,
  );
}
