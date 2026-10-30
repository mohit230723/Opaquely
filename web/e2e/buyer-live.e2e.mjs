// Phase 5 proof against a REAL hardhat node with the contracts deployed
// (node contracts/scripts/dev-node.mjs start; npm --prefix contracts run deploy).
// Phase 7 pages, no role anywhere. A Node helper seeds two listings the way a seller would, then five browser
// contexts take part: the buyer (on /marketplace, /marketplace/{id} and /my-datasets), a stale tab of the same
// buyer, the outsider (Hardhat #2), the seller browsing the Marketplace (its own listing shows Your listing), and
// the seller on My Account (/account, left open to prove polling, then Withdraw and the Transactions order).
// The rejections that cannot be clicked (a wrong amount, a buy of your own listing) are proven at layer level in
// src/data/live/live.integration.test.ts; here the browser shows the own-listing state and proves the double buy
// with the stale tab. Every lookup is scoped to header, main, a dialog or a card: the footer repeats nav names.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, formatEther, getAddress, http } from "viem";
import { hardhat as viemHardhat } from "viem/chains";
import { seedListing } from "./helpers/seed-listing.mjs";

const RPC = "http://127.0.0.1:8545";
const T = { timeout: 30_000 };
const here = path.dirname(fileURLToPath(import.meta.url));
const deployments = JSON.parse(fs.readFileSync(path.resolve(here, "../src/contracts/deployments.json"), "utf8"))["31337"];
const TELEMETRY = "https://pulse.walletconnect.org";
// The seeded bill amounts, as the text a leak would show.
const MARKERS = ["1,507.80", "1507.80", "3,322.40", "3322.40", "2,500.00", "2500.00"];
const PRICE_A = 50_000_000_000_000_000n;
const PRICE_B = 20_000_000_000_000_000n;
const CAN_DECRYPT = "You can decrypt: 6 category totals, 1 anomaly count, grand total.";

/** Mirrors formatEth in src/lib/format.ts: at most 6 decimals, trailing zeros trimmed. */
function eth(wei) {
  const [whole, frac = ""] = formatEther(wei).split(".");
  const trimmed = frac.slice(0, 6).replace(/0+$/, "");
  return `${whole}${trimmed ? `.${trimmed}` : ""} ETH`;
}

export default async function buyerLive({ baseUrl, accounts, assert, waitForWallet, newPage }) {
  const t0 = Date.now();
  const up = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
  }).then((r) => r.ok, () => false);
  if (!up) throw new Error("no hardhat node on " + RPC);

  const chain = { ...viemHardhat, rpcUrls: { default: { http: [RPC] } } };
  const client = createPublicClient({ chain, transport: http(RPC) });
  const mkt = deployments.Marketplace;
  const read = (functionName, args) => client.readContract({ address: mkt.address, abi: mkt.abi, functionName, args });
  const eventAbi = (name) => mkt.abi.find((x) => x.type === "event" && x.name === name);
  const logsOf = (name) =>
    client.getLogs({ address: mkt.address, event: eventAbi(name), fromBlock: BigInt(deployments.deployBlock), toBlock: "latest" });
  const purchasedFor = async (listingId, buyer) =>
    (await logsOf("Purchased")).filter(
      (l) => l.args.listingId === BigInt(listingId) && l.args.buyer.toLowerCase() === buyer.toLowerCase(),
    );
  const seller = getAddress(accounts.seller);

  // ---- every page: requests with bodies, POST targets, console lines ----
  const outgoing = [];
  const posts = [];
  const consoleLines = [];
  const track = (page) => {
    page.on("request", (r) => {
      outgoing.push(r.url() + " " + (r.postData() ?? ""));
      if (r.method() === "POST") posts.push(r.url());
    });
    page.on("console", (m) => consoleLines.push(m.text()));
    return page;
  };
  const noMarkers = async (page, where) => {
    const text = await page.evaluate(() => document.body.innerText);
    for (const m of MARKERS) assert(!text.includes(m), `a bill amount (${m}) is visible on ${where}`);
  };
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

  // ---- (a) node side: two real listings, found later by a per-run tag ----
  const tag = Date.now().toString(36);
  // Counters are asserted as deltas against reads taken right before the thing they measure, never as
  // absolute numbers, so earlier runs on the same node (and their leftovers) do not matter.
  const statsBefore = await read("sellerStats", [seller]);
  const titleA = "Live market " + tag;
  const titleB = "Undeclared market " + tag;
  const seedA = await seedListing({ rpc: RPC, deployments, name: "Buyer-live A " + tag, title: titleA, priceWei: PRICE_A, categories: [0, 1, 4] });
  const seedB = await seedListing({ rpc: RPC, deployments, name: "Buyer-live B " + tag, title: titleB, priceWei: PRICE_B, categories: [] });
  assert(seedA.mask === 19 && seedB.mask === 0, `seeded masks must be 19 and 0, got ${seedA.mask} and ${seedB.mask}`);
  const idA = String(seedA.listingId);
  const idB = String(seedB.listingId);

  // ---- (b) seller's My Account D, opened before the buy and left open (no role: the seller is just a wallet) ----
  const D = track(await newPage({ account: accounts.seller, rpcUrl: RPC, data: "chain" }));
  await D.goto(baseUrl + "/account");
  await waitForWallet(D, accounts.seller);
  await D.locator("main").getByText("Withdrawable balance", { exact: true }).waitFor(T);
  const statsOpen = await read("sellerStats", [seller]);
  assert(statsOpen[0] - statsBefore[0] === 2n, `the seller must have gained exactly 2 listings, got ${statsOpen[0] - statsBefore[0]}`);
  await statWait(D, "Purchases of your listings", String(statsOpen[1]));
  await statWait(D, "Datasets for sale", String(statsOpen[0]));

  // ---- (c) buyer A browses and filters on /marketplace (MKT-03) ----
  const A = track(await newPage({ account: accounts.buyer, rpcUrl: RPC, data: "chain" }));
  await A.goto(baseUrl + "/marketplace");
  await waitForWallet(A, accounts.buyer);
  const aMain = A.locator("main");
  const cardOf = (page, title) =>
    page
      .locator("main")
      .locator('li[data-testid="listing-card"]')
      .filter({ has: page.getByRole("link", { name: title, exact: true }) });
  const cardA = cardOf(A, titleA);
  const cardB = cardOf(A, titleB);
  await cardA.waitFor(T);
  const textA = await cardA.innerText();
  for (const s of ["0xf39F…2266", "0.05 ETH", "3 bills", "Utilities", "Groceries/Food", "Shopping"]) {
    assert(textA.includes(s), `listing A card must show "${s}", got: ${textA}`);
  }
  assert(!textA.includes("Categories not declared by the seller"), "listing A declared its categories");
  assert((await cardA.getByRole("button", { name: "Buy this dataset" }).count()) === 1, "listing A card must offer Buy this dataset");
  await cardB.waitFor(T);
  const textB = await cardB.innerText();
  assert(textB.includes("Categories not declared by the seller"), "listing B card must say categories are not declared");
  assert(textB.includes("0.02 ETH"), "listing B card must show 0.02 ETH, got: " + textB);
  await noMarkers(A, "/marketplace");

  await aMain.getByLabel("Search").fill(tag);
  await cardA.waitFor(T);
  await cardB.waitFor(T);
  await aMain.getByRole("checkbox", { name: "Groceries/Food" }).check();
  await cardA.waitFor(T);
  await cardB.waitFor({ state: "detached", ...T });
  await aMain.getByRole("checkbox", { name: "Groceries/Food" }).uncheck();
  await cardB.waitFor(T);
  await aMain.getByRole("checkbox", { name: "Medical" }).check();
  await cardA.waitFor({ state: "detached", ...T });
  await aMain.getByRole("checkbox", { name: "Medical" }).uncheck();
  await cardA.waitFor(T);
  await aMain.getByLabel("Min price (ETH)").fill("0.03");
  await cardA.waitFor(T);
  await cardB.waitFor({ state: "detached", ...T });
  await aMain.getByLabel("Min price (ETH)").fill("0.1");
  await cardA.waitFor({ state: "detached", ...T });
  await aMain.getByRole("button", { name: "Clear filters" }).first().click();
  await cardA.waitFor(T);
  await cardB.waitFor(T);

  // ---- (d) detail page /marketplace/{id}, reached from the card's title link ----
  await cardA.getByRole("link", { name: titleA, exact: true }).click();
  await A.waitForURL((u) => u.pathname === "/marketplace/" + idA, { timeout: 15_000 });
  await A.getByRole("heading", { level: 1, name: titleA }).waitFor(T);
  await aMain.getByText("One-time payment. Permanent access.").waitFor(T);
  await aMain.getByText("Categories are declared by the seller and not verified.").waitFor(T);
  const buyA = aMain.getByRole("button", { name: "Buy this dataset" });
  await buyA.waitFor(T);
  assert((await buyA.getAttribute("aria-disabled")) !== "true", "Buy this dataset must be enabled for the buyer");

  // ---- (e) stale tab B opens its purchase dialog BEFORE the first tab buys (PD-8) ----
  const B = track(await newPage({ account: accounts.buyer, rpcUrl: RPC, data: "chain" }));
  await B.goto(baseUrl + "/marketplace/" + idA);
  await waitForWallet(B, accounts.buyer);
  await B.locator("main").getByRole("button", { name: "Buy this dataset" }).click({ timeout: 25_000 });
  const staleDialog = B.getByRole("dialog", { name: "Confirm purchase" });
  await staleDialog.waitFor(T);

  // ---- (f) the first tab pays the exact price (MKT-06) ----
  await A.bringToFront();
  const statsPreBuy = await read("sellerStats", [seller]);
  await buyA.click();
  const dialog = A.getByRole("dialog", { name: "Confirm purchase" });
  await dialog.waitFor(T);
  const dialogText = await dialog.innerText();
  assert(dialogText.includes("You are paying 0.05 ETH to 0xf39F…2266"), "dialog must name the price and the seller, got: " + dialogText);
  await dialog.getByRole("button", { name: "Pay 0.05 ETH" }).click();
  await dialog.getByText("Transaction confirmed").waitFor(T);
  await dialog.getByText("Access granted.", { exact: true }).waitFor(T);
  await dialog.getByText("Awaiting signature", { exact: true }).waitFor(T);
  await dialog.getByText("Pending", { exact: true }).waitFor(T);
  const logsA = await purchasedFor(idA, accounts.buyer);
  assert(logsA.length === 1, "exactly one Purchased event for the buyer and listing A, got " + logsA.length);
  const hashA = logsA[0].transactionHash;
  await dialog.getByRole("button", { name: "View my datasets" }).click();
  await A.waitForURL((u) => u.pathname === "/my-datasets", { timeout: 15_000 });

  // ---- (g) the purchase under Bought by me on My Datasets (DASH-02) ----
  const boughtA = aMain.getByTestId("bought-dataset").filter({ has: A.getByRole("link", { name: titleA, exact: true }) });
  await boughtA.waitFor(T);
  const boughtText = await boughtA.innerText();
  assert(boughtText.includes("Paid 0.05 ETH"), "the bought card must show Paid 0.05 ETH, got: " + boughtText);
  assert((await exactCount(boughtA, "Access granted")) === 1, "the bought card must show Access granted");
  const analytics = boughtA.getByRole("button", { name: "View Analytics" });
  assert((await analytics.getAttribute("aria-disabled")) === "true", "View Analytics must be disabled until Milestone 2");
  await boughtA.getByText("Coming in Milestone 2.").waitFor(T);
  // The card's titles hold the seller address and the tx hash; the hash is the 32-byte one.
  const cardTitles = await boughtA.locator('[title^="0x"]').evaluateAll((els) => els.map((e) => e.getAttribute("title") ?? ""));
  const hashTitle = cardTitles.find((t) => /^0x[0-9a-f]{64}$/i.test(t));
  assert(hashTitle === hashA, `purchase hash ${hashTitle} must equal the Purchased tx hash ${hashA}`);
  await noMarkers(A, "/my-datasets");

  // ---- (h) polling: the open My Account catches the sale without a reload (DASH-01) ----
  await D.bringToFront();
  await statWait(D, "Purchases of your listings", String(statsPreBuy[1] + 1n), 15_000);
  const statsPostBuy = await read("sellerStats", [seller]);
  const pending = statsPostBuy[2];
  assert(
    pending - statsPreBuy[2] === PRICE_A,
    `withdrawable ${pending} must be ${statsPreBuy[2]} (read before the buy) + the price ${PRICE_A}`,
  );
  await statWait(D, "Held until withdrawn", eth(pending), 15_000);

  // ---- (i) stale tab B pays again: refused, nothing charged twice ----
  await B.bringToFront();
  await staleDialog.waitFor(T);
  await staleDialog.getByRole("button", { name: "Pay 0.05 ETH" }).click();
  await staleDialog.getByText("Transaction failed").waitFor(T);
  await staleDialog.getByText("You already own this dataset.").first().waitFor(T);
  assert((await purchasedFor(idA, accounts.buyer)).length === 1, "the stale tab must not buy twice");
  await staleDialog.getByRole("button", { name: "Back to listing" }).click();
  await B.locator("main").getByText("Access granted", { exact: true }).waitFor({ timeout: 10_000 });
  assert(
    (await B.locator("main").getByRole("button", { name: "Decrypt insights (coming in M2)" }).getAttribute("aria-disabled")) === "true",
    "the stale tab decrypt button must be disabled",
  );

  // ---- (j) access per wallet, switched inside one tab without a reload (MKT-08) ----
  await A.bringToFront();
  await A.goto(baseUrl + "/marketplace/" + idA);
  await waitForWallet(A, accounts.buyer);
  await aMain.getByText("Access granted", { exact: true }).waitFor(T);
  await aMain.getByText(CAN_DECRYPT).waitFor(T);
  assert((await aMain.getByRole("button", { name: "Buy this dataset" }).count()) === 0, "no Buy button once access is granted");
  await A.evaluate((a) => window.__opaquelyE2E.setAccount(a), accounts.outsider);
  await waitForWallet(A, accounts.outsider);
  await aMain.getByRole("button", { name: "Buy this dataset" }).waitFor(T);
  assert((await exactCount(aMain, "Access granted")) === 0, "switching to another wallet must drop Access granted");
  await A.evaluate((a) => window.__opaquelyE2E.setAccount(a), accounts.buyer);
  await waitForWallet(A, accounts.buyer);
  await aMain.getByText("Access granted", { exact: true }).waitFor(T);

  // ---- (k) outsider C: nothing ----
  const C = track(await newPage({ account: accounts.outsider, rpcUrl: RPC, data: "chain" }));
  const cMain = C.locator("main");
  await C.goto(baseUrl + "/marketplace/" + idA);
  await waitForWallet(C, accounts.outsider);
  const buyC = cMain.getByRole("button", { name: "Buy this dataset" });
  await buyC.waitFor(T);
  assert((await buyC.getAttribute("aria-disabled")) !== "true", "Buy this dataset must be enabled for the outsider");
  assert((await exactCount(cMain, "Access granted")) === 0, "the outsider must not see Access granted");
  await C.goto(baseUrl + "/my-datasets");
  await waitForWallet(C, accounts.outsider);
  await cMain.getByText("No purchases yet").waitFor(T);
  await C.goto(baseUrl + "/marketplace/999999");
  await waitForWallet(C, accounts.outsider);
  await cMain.getByText("Listing not found").first().waitFor(T);
  assert((await read("hasAccess", [BigInt(idA), accounts.outsider])) === false, "chain: the outsider has no access");

  // ---- (l) own listing: the seller browsing the Marketplace cannot buy its own listing ----
  const E = track(await newPage({ account: accounts.seller, rpcUrl: RPC, data: "chain" }));
  const eMain = E.locator("main");
  await E.goto(baseUrl + "/marketplace");
  await waitForWallet(E, accounts.seller);
  const ownCard = cardOf(E, titleA);
  await ownCard.waitFor(T);
  await ownCard.getByText("Your listing", { exact: true }).waitFor(T);
  assert((await exactCount(ownCard, "Your listing")) === 1, "the seller's own listing must carry the Your listing chip");
  assert((await ownCard.getByRole("button", { name: "Buy this dataset" }).count()) === 0, "the seller's own card must not offer Buy");
  await E.goto(baseUrl + "/marketplace/" + idA);
  await waitForWallet(E, accounts.seller);
  await eMain.getByText("This is your listing. You cannot buy it.").waitFor(T);
  assert(
    (await eMain.getByRole("button", { name: "Buy this dataset" }).getAttribute("aria-disabled")) === "true",
    "Buy this dataset must be disabled on the seller's own listing",
  );
  assert((await read("hasAccess", [BigInt(idA), seller])) === false, "chain: the seller has no purchase access to its own listing");

  // ---- (m) withdraw on My Account: balance identity (DASH-01) ----
  await D.bringToFront();
  const dMain = D.locator("main");
  const bal0 = await client.getBalance({ address: seller });
  const blockBeforeWithdraw = await client.getBlockNumber();
  await dMain.getByRole("button", { name: "Withdraw balance" }).click();
  await dMain.getByText("Transaction confirmed").waitFor(T);
  await dMain.getByText("Nothing to withdraw yet.").waitFor(T);
  await statWait(D, "Held until withdrawn", "0 ETH");
  assert((await read("sellerStats", [seller]))[2] === 0n, "chain: nothing left to withdraw");
  // This click's withdrawal: the first Withdrawn event for the seller after the block read before the click.
  const withdrawn = (await logsOf("Withdrawn")).filter(
    (l) => l.args.seller.toLowerCase() === seller.toLowerCase() && l.blockNumber > blockBeforeWithdraw,
  );
  assert(withdrawn.length >= 1, "no Withdrawn event for the seller after the withdraw click");
  const lastW = withdrawn[0];
  const amount = lastW.args.amountWei;
  assert(amount >= pending, `Withdrawn amount ${amount} must cover the ${pending} the sale added`);
  const receipt = await client.getTransactionReceipt({ hash: lastW.transactionHash });
  const bal1 = await client.getBalance({ address: seller });
  assert(
    bal1 - bal0 + receipt.gasUsed * receipt.effectiveGasPrice === amount,
    `balance identity: delta ${bal1 - bal0} + gas ${receipt.gasUsed * receipt.effectiveGasPrice} must equal ${amount}`,
  );

  // ---- (n) My Account Transactions in chain order (MKT-10): this wallet's own history, newest first ----
  const timeline = dMain.locator("ol > li");
  await D.waitForFunction(
    (prefix) => (document.querySelector("main ol > li")?.textContent ?? "").startsWith(prefix),
    "You withdrew " + eth(amount),
    T,
  );
  const items = await timeline.allInnerTexts();
  const iW = items.findIndex((t) => t.startsWith("You withdrew " + eth(amount)));
  const iB = items.findIndex((t) => t.startsWith("0x7099…79C8 bought") && t.includes(`"${titleA}" for 0.05 ETH`));
  const iLB = items.findIndex((t) => t.startsWith(`You listed "${titleB}" for 0.02 ETH`));
  const iLA = items.findIndex((t) => t.startsWith(`You listed "${titleA}" for 0.05 ETH`));
  // Newest first: this run's withdrawal, then its sale, then its two listings (B was listed after A).
  assert(iW === 0, `the withdrawal of ${eth(amount)} must be the newest transaction, got index ${iW}`);
  assert(iW < iB && iB < iLB && iLB < iLA, `transactions order: withdrew ${iW}, bought ${iB}, listed B ${iLB}, listed A ${iLA}`);
  const actTitles = await timeline.nth(iB).locator('[title^="0x"]').evaluateAll((els) => els.map((e) => e.getAttribute("title") ?? ""));
  const actHash = actTitles.find((t) => /^0x[0-9a-f]{64}$/i.test(t));
  assert(actHash === hashA, `transaction hash ${actHash} must equal the Purchased tx hash ${hashA}`);

  // ---- (o) My Datasets: A is Sold (one buyer), B is Listed, each with 3 bills ----
  await D.locator("header").getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "My Datasets", exact: true }).click({ timeout: 25_000 });
  await D.waitForURL((u) => u.pathname === "/my-datasets", { timeout: 15_000 });
  for (const [name, chip] of [
    ["Buyer-live A " + tag, "Sold"],
    ["Buyer-live B " + tag, "Listed"],
  ]) {
    const card = dMain.getByTestId("listed-dataset").filter({ has: D.getByRole("heading", { level: 3, name, exact: true }) });
    await card.getByText(chip, { exact: true }).waitFor(T);
    const cardText = await card.innerText();
    assert(cardText.includes("3 bills"), `dataset ${name} must hold 3 bills, got: ${cardText}`);
  }

  // ---- (p) privacy and network over every page ----
  for (const url of posts) {
    assert(url.startsWith(new URL(RPC).origin) || url.startsWith(TELEMETRY), "a POST left for " + url);
  }
  for (const m of MARKERS) {
    assert(!outgoing.some((o) => o.includes(m)), `a bill amount (${m}) appears in a request`);
    assert(!consoleLines.some((l) => l.includes(m)), `a bill amount (${m}) appears in a console line`);
  }

  console.log(
    `  BUYER LIVE OK listing=${idA} undeclared=${idB} buy=${hashA.slice(0, 10)} sales=${statsPreBuy[1] + 1n} withdrawn=${amount} polled=1 ms=${Date.now() - t0}`,
  );
}
