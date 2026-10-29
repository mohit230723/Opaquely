// The whole Phase 1 demo in one tab: the seller adds a bill, checks the chain view and lists a dataset;
// the buyer (second account) buys it; the seller withdraws; the activity timeline tells the story.
// Privacy proof: no POST leaves the page and the typed vendor and amount never reach storage or the console.
//
// Stub state lives in page memory, so after the first page.goto the script only uses in-app links and
// the wallet stub's setAccount; a reload would reseed the stub.

const T = { timeout: 10_000 };
const LONG = { timeout: 25_000 };

const VENDOR = "Corner Store";
const AMOUNT_TEXT = "1,234.50";
const AMOUNT_CENTS = "123450";

// RainbowKit/WalletConnect fires a telemetry POST at this host on load. The runner aborts every
// non-local request, and the payload is wallet-library usage with no page data. Any other POST fails the script.
const WALLET_TELEMETRY_HOST = "pulse.walletconnect.org";

const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default async function walkthrough({ baseUrl, accounts, assert, waitForWallet, newPage }) {
  const { seller, buyer } = accounts;
  const page = await newPage({ account: seller, roles: { [seller]: "seller" }, viewport: { width: 1280, height: 900 } });

  const posts = [];
  const consoleLines = [];
  page.on("request", (req) => {
    if (req.method() !== "POST") return;
    if (new URL(req.url()).hostname === WALLET_TELEMETRY_HOST) return;
    posts.push(req.url());
  });
  page.on("console", (m) => consoleLines.push(m.text()));

  const nav = (role) => page.getByRole("navigation", { name: role });
  const switchTo = (address) => page.evaluate((a) => window.__opaquelyE2E.setAccount(a), address);

  // ---- a. seller: add a bill, then look at the chain view ----
  await page.goto(baseUrl + "/sell");
  await waitForWallet(page, seller);
  await page.getByText("Withdrawable balance").waitFor({ state: "visible", ...LONG });

  await nav("Seller").getByRole("link", { name: "Datasets" }).click();
  await page.waitForURL((u) => u.pathname === "/sell/datasets", { timeout: 15_000 });
  const utilities = page.locator("tr", { hasText: "Household utilities 2026" });
  await utilities.getByRole("link", { name: "Add bill" }).click({ timeout: 25_000 });

  await page.getByLabel("Vendor (optional)").fill(VENDOR);
  await page.getByLabel("Total amount").fill(AMOUNT_TEXT);
  await page.getByLabel("Date").fill("2026-10-01");
  await page.getByRole("radio", { name: "Utilities" }).click();
  await page.getByRole("button", { name: "Add bill to dataset" }).click();
  await page.getByText("Transaction confirmed").waitFor({ state: "visible", ...T });
  await page.getByText("Bill added. This dataset now has 2 bills.").waitFor({ state: "visible", ...T });

  await page.getByRole("link", { name: "Back to dataset" }).click();
  await page.getByRole("link", { name: "Chain view" }).first().click({ timeout: 25_000 });
  await page.getByText("Bill 2", { exact: true }).waitFor({ state: "visible", ...LONG });
  const bill2 = page.locator("li", { has: page.getByRole("heading", { name: "Bill 2" }) });
  const bill1 = page.locator("li", { has: page.getByRole("heading", { name: "Bill 1" }) });
  await bill2.getByText(VENDOR).waitFor({ state: "visible", ...T });
  await bill2.getByText("₹" + AMOUNT_TEXT).waitFor({ state: "visible", ...T });
  await bill1.getByText("Not available after reload").waitFor({ state: "visible", ...T });

  // ---- b. seller: list a dataset ----
  await nav("Seller").getByRole("link", { name: "Datasets" }).click();
  await page.waitForURL((u) => u.pathname === "/sell/datasets", { timeout: 15_000 });
  const groceriesQ3 = page.locator("tr", { hasText: "Groceries Q3" });
  await groceriesQ3.getByRole("link", { name: "List dataset" }).click({ timeout: 25_000 });
  await page.getByLabel("Title").fill("Walkthrough groceries");
  await page.getByLabel("Description").fill("Three grocery bills from one household.");
  await page.getByLabel("Price (ETH)").fill("0.05");
  await page.getByRole("button", { name: "List dataset" }).click();
  await page.getByRole("button", { name: "Seal and list dataset" }).click();
  await page.getByText("Transaction confirmed").waitFor({ state: "visible", ...T });
  await page.getByRole("button", { name: "View my datasets" }).click();
  await page.waitForURL((u) => u.pathname === "/sell/datasets", { timeout: 15_000 });
  await page.locator("tr", { hasText: "Groceries Q3" }).getByText("Listed").waitFor({ state: "visible", ...LONG });

  // ---- c. switch to the buyer account in the same tab ----
  await switchTo(buyer);
  await waitForWallet(page, buyer);
  await page.waitForURL((u) => u.pathname === "/role", { timeout: 25_000 });
  await page.getByText(/Continue as Buyer/).first().click();
  await page.waitForURL((u) => u.pathname === "/buy", { timeout: 15_000 });

  // ---- d. buyer: find the new listing and buy it ----
  await page.getByLabel("Search").fill("Walkthrough groceries");
  await page.getByText(/^Showing 1 of \d+ datasets?$/).waitFor({ state: "visible", ...LONG });
  await page.getByRole("link", { name: /Walkthrough groceries/ }).click();
  await page.getByRole("button", { name: "Buy dataset" }).click({ timeout: 25_000 });
  await page.getByRole("button", { name: "Pay 0.05 ETH" }).click();
  await page.getByText("Access granted.", { exact: true }).waitFor({ state: "visible", ...LONG });
  await page.getByRole("button", { name: "View my purchases" }).click();
  await page.waitForURL((u) => u.pathname === "/buy/purchases", { timeout: 15_000 });
  const purchase = page.locator("li", { hasText: "Walkthrough groceries" });
  await purchase.getByText("Walkthrough groceries").first().waitFor({ state: "visible", ...LONG });
  await purchase.getByText("Paid 0.05 ETH").waitFor({ state: "visible", ...T });
  await purchase.getByText("Access granted", { exact: true }).waitFor({ state: "visible", ...T });

  // ---- e. buyer: the timeline shows the purchase first and the seller's listing below it ----
  await nav("Buyer").getByRole("link", { name: "Activity" }).click();
  await page.waitForURL((u) => u.pathname === "/activity", { timeout: 15_000 });
  await page.getByText('You bought "Walkthrough groceries" for 0.05 ETH').waitFor({ state: "visible", ...LONG });
  const buyerItems = await page.locator("ol > li").allTextContents();
  assert(
    buyerItems[0].includes('You bought "Walkthrough groceries" for 0.05 ETH'),
    `the first timeline item must be the purchase, got: ${buyerItems[0]}`,
  );
  assert(
    buyerItems.slice(1).some((t) => t.includes(`${short(seller)} listed "Walkthrough groceries" for 0.05 ETH`)),
    "a later item must show the seller's listing with the seller's short address",
  );

  // ---- f. back to the seller: withdraw the proceeds ----
  await switchTo(seller);
  await waitForWallet(page, seller);
  await nav("Seller").getByRole("link", { name: "Dashboard" }).click({ timeout: 25_000 });
  await page.waitForURL((u) => u.pathname === "/sell", { timeout: 15_000 });
  await page.getByText("0.11 ETH").waitFor({ state: "visible", ...LONG });
  await page.getByRole("button", { name: "Withdraw balance" }).click();
  await page.getByText("Transaction confirmed").waitFor({ state: "visible", ...T });
  await page.getByText("Nothing to withdraw yet.").waitFor({ state: "visible", ...T });
  await nav("Seller").getByRole("link", { name: "Activity" }).click();
  await page.waitForURL((u) => u.pathname === "/activity", { timeout: 15_000 });
  await page.getByText("You withdrew 0.11 ETH").waitFor({ state: "visible", ...LONG });
  const sellerItems = await page.locator("ol > li").allTextContents();
  assert(sellerItems[0].includes("You withdrew 0.11 ETH"), `the first timeline item must be the withdrawal, got: ${sellerItems[0]}`);

  // ---- g. privacy assertions ----
  assert(posts.length === 0, `no POST request may leave the page, saw: ${posts.join(", ")}`);

  const secrets = [VENDOR, AMOUNT_TEXT, AMOUNT_CENTS];
  for (const line of consoleLines) {
    for (const s of secrets) assert(!line.includes(s), `a console message contains "${s}": ${line.slice(0, 120)}`);
  }

  const storage = await page.evaluate(async () => {
    const dump = (s) => Object.keys(s).map((k) => [k, String(s.getItem(k))]);
    const dbs = indexedDB.databases ? await indexedDB.databases() : [];
    return { local: dump(localStorage), session: dump(sessionStorage), databases: dbs.map((d) => d.name ?? "") };
  });
  for (const [kind, entries] of [
    ["localStorage", storage.local],
    ["sessionStorage", storage.session],
  ]) {
    for (const [key, value] of entries) {
      for (const s of secrets) {
        assert(!key.includes(s) && !value.includes(s), `${kind} key "${key}" holds "${s}"`);
      }
    }
  }
  const ownKeys = storage.local.map(([k]) => k).filter((k) => /^opaquely/i.test(k));
  assert(ownKeys.every((k) => k.startsWith("opaquely:role:")), `unexpected app localStorage keys: ${ownKeys.join(", ")}`);
  assert(ownKeys.length >= 1, "the role keys must be present");
  assert(!storage.databases.some((n) => /^opaquely/i.test(n)), `no opaquely IndexedDB database may exist: ${storage.databases.join(", ")}`);
  console.log("  walkthrough localStorage keys: " + (storage.local.map(([k]) => k).join(", ") || "(none)"));
  console.log("  walkthrough sessionStorage keys: " + (storage.session.map(([k]) => k).join(", ") || "(none)"));
  console.log("  walkthrough indexedDB databases: " + (storage.databases.join(", ") || "(none)"));
}
