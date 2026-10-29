// Phase 5 proof against a REAL hardhat node with the contracts deployed
// (node contracts/scripts/dev-node.mjs start; npm --prefix contracts run deploy).
// A Node helper seeds two listings the way a seller would, then five browser contexts take part: the buyer,
// a stale tab of the same buyer, the outsider (Hardhat #2), the seller with a buyer role, and the seller on
// the dashboard (left open to prove polling). The rejections that cannot be clicked (a wrong amount, a buy of
// your own listing) are proven at layer level in src/data/live/live.integration.test.ts; here the browser
// shows the own-listing state and proves the double buy with the stale tab.
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
  const statsBefore = await read("sellerStats", [seller]);
  const titleA = "Live market " + tag;
  const titleB = "Undeclared market " + tag;
  const seedA = await seedListing({ rpc: RPC, deployments, name: "Buyer-live A " + tag, title: titleA, priceWei: PRICE_A, categories: [0, 1, 4] });
  const seedB = await seedListing({ rpc: RPC, deployments, name: "Buyer-live B " + tag, title: titleB, priceWei: PRICE_B, categories: [] });
  assert(seedA.mask === 19 && seedB.mask === 0, `seeded masks must be 19 and 0, got ${seedA.mask} and ${seedB.mask}`);
  const idA = String(seedA.listingId);
  const idB = String(seedB.listingId);

  // ---- (b) seller dashboard D, opened before the buy and left open ----
  const D = track(await newPage({ account: accounts.seller, roles: { [accounts.seller]: "seller" }, rpcUrl: RPC, data: "chain" }));
  await D.goto(baseUrl + "/sell");
  await waitForWallet(D, accounts.seller);
  await D.getByText("Withdrawable balance", { exact: true }).waitFor(T);
  await statWait(D, "Purchases of your listings", String(statsBefore[1]));
  await statWait(D, "Datasets for sale", String(statsBefore[0] + 2n));

  // ---- (c) buyer A browses and filters (MKT-03) ----
  const A = track(
    await newPage({
      account: accounts.buyer,
      roles: { [accounts.buyer]: "buyer", [accounts.outsider]: "buyer" },
      rpcUrl: RPC,
      data: "chain",
    }),
  );
  await A.goto(baseUrl + "/buy");
  await waitForWallet(A, accounts.buyer);
  const cardA = A.getByRole("link", { name: titleA });
  const cardB = A.getByRole("link", { name: titleB });
  await cardA.waitFor(T);
  const textA = await cardA.innerText();
  for (const s of ["0xf39F…2266", "0.05 ETH", "3 bills", "Utilities", "Groceries/Food", "Shopping"]) {
    assert(textA.includes(s), `listing A card must show "${s}", got: ${textA}`);
  }
  assert(!textA.includes("Categories not declared by the seller"), "listing A declared its categories");
  await cardB.waitFor(T);
  const textB = await cardB.innerText();
  assert(textB.includes("Categories not declared by the seller"), "listing B card must say categories are not declared");
  assert(textB.includes("0.02 ETH"), "listing B card must show 0.02 ETH, got: " + textB);
  await noMarkers(A, "/buy");

  await A.getByLabel("Search").fill(tag);
  await cardA.waitFor(T);
  await cardB.waitFor(T);
  await A.getByRole("checkbox", { name: "Groceries/Food" }).check();
  await cardA.waitFor(T);
  await cardB.waitFor({ state: "detached", ...T });
  await A.getByRole("checkbox", { name: "Groceries/Food" }).uncheck();
  await cardB.waitFor(T);
  await A.getByRole("checkbox", { name: "Medical" }).check();
  await cardA.waitFor({ state: "detached", ...T });
  await A.getByRole("checkbox", { name: "Medical" }).uncheck();
  await cardA.waitFor(T);
  await A.getByLabel("Min price (ETH)").fill("0.03");
  await cardA.waitFor(T);
  await cardB.waitFor({ state: "detached", ...T });
  await A.getByLabel("Min price (ETH)").fill("0.1");
  await cardA.waitFor({ state: "detached", ...T });
  await A.getByRole("button", { name: "Clear filters" }).first().click();
  await cardA.waitFor(T);
  await cardB.waitFor(T);

  // ---- (d) detail page ----
  await cardA.click();
  await A.getByRole("heading", { level: 1, name: titleA }).waitFor(T);
  await A.getByText("One-time payment. Permanent access.").waitFor(T);
  await A.getByText("Categories are declared by the seller and not verified.").waitFor(T);
  const buyA = A.getByRole("button", { name: "Buy dataset" });
  await buyA.waitFor(T);
  assert((await buyA.getAttribute("aria-disabled")) !== "true", "Buy must be enabled for the buyer");

  // ---- (e) stale tab B opens its purchase dialog BEFORE the first tab buys (PD-8) ----
  const B = track(await newPage({ account: accounts.buyer, roles: { [accounts.buyer]: "buyer" }, rpcUrl: RPC, data: "chain" }));
  await B.goto(baseUrl + "/buy/" + idA);
  await waitForWallet(B, accounts.buyer);
  await B.getByRole("button", { name: "Buy dataset" }).click();
  await B.getByText("Confirm purchase").waitFor(T);

  // ---- (f) the first tab pays the exact price (MKT-06) ----
  await A.bringToFront();
  await buyA.click();
  const dialog = A.getByRole("dialog");
  await dialog.getByText("Confirm purchase").waitFor(T);
  const dialogText = await dialog.innerText();
  assert(dialogText.includes("You are paying 0.05 ETH to 0xf39F…2266"), "dialog must name the price and the seller, got: " + dialogText);
  await dialog.getByRole("button", { name: "Pay 0.05 ETH" }).click();
  await A.getByText("Transaction confirmed").waitFor(T);
  await A.getByText("Access granted.", { exact: true }).waitFor(T);
  await dialog.getByText("Awaiting signature", { exact: true }).waitFor(T);
  await dialog.getByText("Pending", { exact: true }).waitFor(T);
  const logsA = await purchasedFor(idA, accounts.buyer);
  assert(logsA.length === 1, "exactly one Purchased event for the buyer and listing A, got " + logsA.length);
  const hashA = logsA[0].transactionHash;
  await dialog.getByRole("button", { name: "View my purchases" }).click();
  await A.waitForURL((u) => u.pathname === "/buy/purchases", { timeout: 15_000 });

  // ---- (g) purchases (DASH-02) ----
  const row = A.locator("li", { hasText: titleA });
  await row.first().waitFor(T);
  const rowText = await row.first().innerText();
  assert(rowText.includes("Paid 0.05 ETH"), "purchase row must show Paid 0.05 ETH, got: " + rowText);
  assert(rowText.includes(CAN_DECRYPT), "purchase row must show what the buyer can decrypt, got: " + rowText);
  assert((await exactCount(row.first(), "Access granted")) === 1, "purchase row must show Access granted");
  const decryptA = row.first().getByRole("button", { name: "Decrypt insights (coming in M2)" });
  assert((await decryptA.getAttribute("aria-disabled")) === "true", "the decrypt button must be disabled");
  const hashTitle = await row.first().locator('[title^="0x"]').first().getAttribute("title");
  assert(hashTitle === hashA, `purchase hash ${hashTitle} must equal the Purchased tx hash ${hashA}`);
  await noMarkers(A, "/buy/purchases");

  // ---- (h) polling: the open dashboard catches the sale without a reload (DASH-01) ----
  await D.bringToFront();
  await statWait(D, "Purchases of your listings", String(statsBefore[1] + 1n), 15_000);
  const pending = (await read("sellerStats", [seller]))[2];
  assert(pending === statsBefore[2] + PRICE_A, `withdrawable ${pending} must be before ${statsBefore[2]} + the price`);
  await statWait(D, "Held until withdrawn", eth(pending), 15_000);

  // ---- (i) stale tab B pays again: refused, nothing charged twice ----
  await B.bringToFront();
  await B.getByText("Confirm purchase").waitFor(T);
  await B.getByRole("button", { name: "Pay 0.05 ETH" }).click();
  await B.getByText("Transaction failed").waitFor(T);
  await B.getByText("You already own this dataset.").first().waitFor(T);
  assert((await purchasedFor(idA, accounts.buyer)).length === 1, "the stale tab must not buy twice");
  await B.getByRole("button", { name: "Back to listing" }).click();
  await B.getByText("Access granted", { exact: true }).waitFor({ timeout: 10_000 });
  assert(
    (await B.getByRole("button", { name: "Decrypt insights (coming in M2)" }).getAttribute("aria-disabled")) === "true",
    "the stale tab decrypt button must be disabled",
  );

  // ---- (j) access per wallet, switched inside one tab without a reload (MKT-08) ----
  await A.bringToFront();
  await A.goto(baseUrl + "/buy/" + idA);
  await waitForWallet(A, accounts.buyer);
  await A.getByText("Access granted", { exact: true }).waitFor(T);
  await A.getByText(CAN_DECRYPT).waitFor(T);
  assert((await A.getByRole("button", { name: "Buy dataset" }).count()) === 0, "no Buy button once access is granted");
  await A.evaluate((a) => window.__opaquelyE2E.setAccount(a), accounts.outsider);
  await waitForWallet(A, accounts.outsider);
  await A.getByRole("button", { name: "Buy dataset" }).waitFor(T);
  assert((await exactCount(A, "Access granted")) === 0, "switching to another wallet must drop Access granted");
  await A.evaluate((a) => window.__opaquelyE2E.setAccount(a), accounts.buyer);
  await waitForWallet(A, accounts.buyer);
  await A.getByText("Access granted", { exact: true }).waitFor(T);

  // ---- (k) outsider C: nothing ----
  const C = track(await newPage({ account: accounts.outsider, roles: { [accounts.outsider]: "buyer" }, rpcUrl: RPC, data: "chain" }));
  await C.goto(baseUrl + "/buy/" + idA);
  await waitForWallet(C, accounts.outsider);
  const buyC = C.getByRole("button", { name: "Buy dataset" });
  await buyC.waitFor(T);
  assert((await buyC.getAttribute("aria-disabled")) !== "true", "Buy must be enabled for the outsider");
  assert((await exactCount(C, "Access granted")) === 0, "the outsider must not see Access granted");
  await C.goto(baseUrl + "/buy/purchases");
  await waitForWallet(C, accounts.outsider);
  await C.getByText("No purchases yet").waitFor(T);
  await C.goto(baseUrl + "/buy/999999");
  await waitForWallet(C, accounts.outsider);
  await C.getByText("Listing not found").first().waitFor(T);
  assert((await read("hasAccess", [BigInt(idA), accounts.outsider])) === false, "chain: the outsider has no access");

  // ---- (l) own listing: the seller with a buyer role cannot buy ----
  const E = track(await newPage({ account: accounts.seller, roles: { [accounts.seller]: "buyer" }, rpcUrl: RPC, data: "chain" }));
  await E.goto(baseUrl + "/buy");
  await waitForWallet(E, accounts.seller);
  await E.getByRole("link", { name: titleA }).waitFor(T);
  assert(
    (await exactCount(E.getByRole("link", { name: titleA }), "Your listing")) === 1,
    "the seller's own listing must carry the Your listing chip",
  );
  await E.goto(baseUrl + "/buy/" + idA);
  await waitForWallet(E, accounts.seller);
  await E.getByText("This is your listing. You cannot buy it.").waitFor(T);
  assert(
    (await E.getByRole("button", { name: "Buy dataset" }).getAttribute("aria-disabled")) === "true",
    "Buy must be disabled on the seller's own listing",
  );
  assert((await read("hasAccess", [BigInt(idA), seller])) === false, "chain: the seller has no purchase access to its own listing");

  // ---- (m) withdraw on the dashboard: balance identity (DASH-01) ----
  await D.bringToFront();
  const bal0 = await client.getBalance({ address: seller });
  await D.getByRole("button", { name: "Withdraw balance" }).click();
  await D.getByText("Transaction confirmed").waitFor(T);
  await D.getByText("Nothing to withdraw yet.").waitFor(T);
  await statWait(D, "Held until withdrawn", "0 ETH");
  assert((await read("sellerStats", [seller]))[2] === 0n, "chain: nothing left to withdraw");
  const withdrawn = (await logsOf("Withdrawn")).filter((l) => l.args.seller.toLowerCase() === seller.toLowerCase());
  const lastW = withdrawn[withdrawn.length - 1];
  assert(lastW.args.amountWei === pending, `Withdrawn amount ${lastW.args.amountWei} must equal pending ${pending}`);
  const receipt = await client.getTransactionReceipt({ hash: lastW.transactionHash });
  const bal1 = await client.getBalance({ address: seller });
  assert(
    bal1 - bal0 + receipt.gasUsed * receipt.effectiveGasPrice === pending,
    `balance identity: delta ${bal1 - bal0} + gas ${receipt.gasUsed * receipt.effectiveGasPrice} must equal ${pending}`,
  );
  await D.goto(baseUrl + "/sell/datasets");
  await waitForWallet(D, accounts.seller);
  for (const name of ["Buyer-live A " + tag, "Buyer-live B " + tag]) {
    const tr = D.locator("tr", { hasText: name });
    await tr.first().waitFor(T);
    const trText = await tr.first().innerText();
    assert(trText.includes("Listed"), `dataset ${name} must be Listed, got: ${trText}`);
    assert((await tr.first().locator("td").nth(1).innerText()).trim() === "3", `dataset ${name} must hold 3 bills`);
  }

  // ---- (n) activity in chain order (MKT-10) ----
  await D.goto(baseUrl + "/activity");
  await waitForWallet(D, accounts.seller);
  await D.locator("ol > li", { hasText: "You withdrew" }).first().waitFor(T);
  const items = await D.locator("ol > li").allInnerTexts();
  assert(items[0].startsWith("You withdrew " + eth(pending)), `newest event must be the withdrawal of ${eth(pending)}, got: ${items[0]}`);
  const iB = items.findIndex((t) => t.startsWith("0x7099…79C8 bought") && t.includes(`"${titleA}" for 0.05 ETH`));
  const iLB = items.findIndex((t) => t.startsWith(`You listed "${titleB}" for 0.02 ETH`));
  const iLA = items.findIndex((t) => t.startsWith(`You listed "${titleA}" for 0.05 ETH`));
  assert(iB > 0 && iB < iLB && iLB < iLA, `activity order: bought ${iB}, listed B ${iLB}, listed A ${iLA}`);
  const actHash = await D.locator("ol > li").nth(iB).locator('[title^="0x"]').first().getAttribute("title");
  assert(actHash === hashA, `activity hash ${actHash} must equal the Purchased tx hash ${hashA}`);

  // ---- (o) privacy and network over every page ----
  for (const url of posts) {
    assert(url.startsWith(new URL(RPC).origin) || url.startsWith(TELEMETRY), "a POST left for " + url);
  }
  for (const m of MARKERS) {
    assert(!outgoing.some((o) => o.includes(m)), `a bill amount (${m}) appears in a request`);
    assert(!consoleLines.some((l) => l.includes(m)), `a bill amount (${m}) appears in a console line`);
  }

  console.log(
    `  BUYER LIVE OK listing=${idA} undeclared=${idB} buy=${hashA.slice(0, 10)} sales=${statsBefore[1] + 1n} withdrawn=${pending} polled=1 ms=${Date.now() - t0}`,
  );
}
