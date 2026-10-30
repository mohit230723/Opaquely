// The whole demo story in one tab on the Phase 7 pages, with no role anywhere: the seller resumes a draft in
// Upload, encrypts a bill and sees its chain row, lists another draft with List to Marketplace; the buyer (a
// second wallet) buys it with Buy this dataset and finds it under Bought by me; My Account shows each wallet's
// own history; the seller withdraws.
// Privacy proof: no POST leaves the page and the typed vendor and amount never reach storage or the console,
// and the app keeps no localStorage key of its own.
//
// Stub state lives in page memory, so after the first page.goto the script only uses in-app links and the wallet
// stub's setAccount; a reload would reseed the stub. Every link and button lookup is scoped to header, main, a
// dialog or a card: the footer repeats the nav link names.

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
  const page = await newPage({ account: seller, viewport: { width: 1280, height: 900 } });

  const posts = [];
  const consoleLines = [];
  page.on("request", (req) => {
    if (req.method() !== "POST") return;
    if (new URL(req.url()).hostname === WALLET_TELEMETRY_HOST) return;
    posts.push(req.url());
  });
  page.on("console", (m) => consoleLines.push(m.text()));

  const main = page.locator("main");
  const primary = page.locator("header").getByRole("navigation", { name: "Primary" });
  const switchTo = (address) => page.evaluate((a) => window.__opaquelyE2E.setAccount(a), address);
  const listedCard = (name) => main.getByTestId("listed-dataset").filter({ hasText: name });
  const encryptedBills = main.locator("section", { has: page.getByRole("heading", { level: 2, name: "Encrypted bills" }) });
  const billRow = (n) => encryptedBills.locator("li").filter({ has: page.getByRole("heading", { level: 3, name: "Bill " + n }) });
  // The value p beside a stat caption (the stat cards keep label, value and caption in one parent).
  const statWait = (caption, expected) =>
    page.waitForFunction(
      ([c, e]) => {
        const p = [...document.querySelectorAll("main p")].find((x) => x.textContent === c);
        return p?.parentElement?.querySelector("p.tabular-nums")?.textContent === e;
      },
      [caption, expected],
      LONG,
    );
  const goPrimary = async (name, pathname) => {
    await primary.getByRole("link", { name, exact: true }).click({ timeout: 25_000 });
    await page.waitForURL((u) => u.pathname === pathname, { timeout: 15_000 });
  };
  const resumeInUpload = async (name, id) => {
    const card = listedCard(name);
    await card.waitFor({ state: "visible", ...LONG });
    await card.getByRole("link", { name: "Continue in Upload" }).click();
    await page.waitForURL((u) => u.pathname === "/upload" && u.searchParams.get("dataset") === id, { timeout: 15_000 });
    await page.waitForFunction(
      (n) => document.querySelector('main input[name="dataset-name"]')?.value === n,
      name,
      LONG,
    );
  };

  // ---- a. seller: resume a draft in Upload, encrypt a bill, see its chain row ----
  await page.goto(baseUrl + "/my-datasets");
  await waitForWallet(page, seller);
  await main.getByRole("heading", { name: "Listed by me", level: 2 }).waitFor({ state: "visible", ...LONG });
  await resumeInUpload("Household utilities 2026", "household-utilities-2026");

  await main.getByLabel("Vendor (optional)").fill(VENDOR);
  await main.getByLabel("Total amount").fill(AMOUNT_TEXT);
  await main.getByLabel("Date").fill("2026-10-01");
  await main.getByRole("radio", { name: "Utilities" }).click();
  await main.getByRole("button", { name: "Encrypt", exact: true }).click();
  await main.getByText("Transaction confirmed").waitFor({ state: "visible", ...LONG });
  await main.getByText("Bill encrypted. This dataset has 2 bills.").waitFor({ state: "visible", ...T });

  await billRow(2).getByText(VENDOR).waitFor({ state: "visible", ...T });
  await billRow(2).getByText("₹" + AMOUNT_TEXT).waitFor({ state: "visible", ...T });
  await billRow(1).getByText("Not available after reload").waitFor({ state: "visible", ...T });

  // ---- b. seller: list Groceries Q3 from its card with List to Marketplace ----
  await goPrimary("My Datasets", "/my-datasets");
  await resumeInUpload("Groceries Q3", "groceries-q3");
  await main.getByLabel("Description").fill("Three grocery bills from one household.");
  await main.getByLabel("Price (ETH)").fill("0.05");
  await main.getByRole("button", { name: "List to Marketplace", exact: true }).click();
  const listDialog = page.getByRole("dialog");
  await listDialog.getByRole("heading", { name: 'List "Groceries Q3"?' }).waitFor({ state: "visible", ...T });
  await listDialog.getByRole("button", { name: "List to Marketplace", exact: true }).click();
  await listDialog.getByText("Transaction confirmed").waitFor({ state: "visible", ...LONG });
  await page.waitForURL((u) => u.pathname === "/marketplace", { timeout: 15_000 });

  // ---- c. switch to the buyer wallet in the same tab (no role step) ----
  await switchTo(buyer);
  await waitForWallet(page, buyer);
  assert(new URL(page.url()).pathname === "/marketplace", "switching wallets must not leave the Marketplace");

  // ---- d. buyer: buy Groceries Q3 from its card, then find it under Bought by me ----
  const card = main
    .locator('li[data-testid="listing-card"]')
    .filter({ has: page.getByRole("link", { name: "Groceries Q3", exact: true }) });
  await card.waitFor({ state: "visible", ...LONG });
  await card.getByRole("button", { name: "Buy this dataset" }).click({ timeout: 25_000 });
  const buyDialog = page.getByRole("dialog", { name: "Confirm purchase" });
  await buyDialog.waitFor({ state: "visible", ...T });
  await buyDialog.getByRole("button", { name: "Pay 0.05 ETH" }).click();
  await buyDialog.getByText("Access granted.", { exact: true }).waitFor({ state: "visible", ...LONG });
  await buyDialog.getByRole("button", { name: "View my datasets" }).click();
  await page.waitForURL((u) => u.pathname === "/my-datasets", { timeout: 15_000 });
  const bought = main.getByTestId("bought-dataset").filter({ hasText: "Groceries Q3" });
  await bought.waitFor({ state: "visible", ...LONG });
  await bought.getByText(/^Paid 0\.05 ETH$/).waitFor({ state: "visible", ...T });
  await bought.getByText("Access granted", { exact: true }).waitFor({ state: "visible", ...T });

  // ---- e. buyer: My Account's Transactions starts with the purchase and holds only this wallet's history ----
  await goPrimary("My Account", "/account");
  await main.getByText('You bought "Groceries Q3" for 0.05 ETH').waitFor({ state: "visible", ...LONG });
  const buyerItems = await main.locator("ol > li").allTextContents();
  assert(
    buyerItems[0].startsWith('You bought "Groceries Q3"'),
    `the first timeline item must be the purchase, got: ${buyerItems[0]}`,
  );
  assert(
    !buyerItems.some((t) => t.includes(`${short(seller)} listed`)),
    "the buyer's history must not show another wallet's listing",
  );

  // ---- f. back to the seller: withdraw the proceeds on My Account ----
  await switchTo(seller);
  await waitForWallet(page, seller);
  await goPrimary("My Account", "/account");
  await statWait("Held until withdrawn", "0.11 ETH");
  await main.getByRole("button", { name: "Withdraw balance" }).click();
  await main.getByText("Transaction confirmed").waitFor({ state: "visible", ...LONG });
  await main.getByText("Nothing to withdraw yet.").waitFor({ state: "visible", ...T });
  await statWait("Held until withdrawn", "0 ETH");
  await main.getByText("You withdrew 0.11 ETH").waitFor({ state: "visible", ...LONG });
  // Withdrawn so far is its own figure: the seeded 0.04 ETH plus this 0.11 ETH.
  await statWait("Already sent to your wallet", "0.15 ETH");
  const sellerItems = await main.locator("ol > li").allTextContents();
  assert(sellerItems[0].includes("You withdrew 0.11 ETH"), `the first timeline item must be the withdrawal, got: ${sellerItems[0]}`);
  assert(
    sellerItems.slice(1).some((t) => t.includes(`${short(buyer)} bought "Groceries Q3" for 0.05 ETH`)),
    "a later item must show the buyer's purchase of the seller's listing",
  );

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
  assert(ownKeys.length === 0, `the app must keep no localStorage key of its own, found: ${ownKeys.join(", ")}`);
  assert(!storage.databases.some((n) => /^opaquely/i.test(n)), `no opaquely IndexedDB database may exist: ${storage.databases.join(", ")}`);
  console.log("  walkthrough localStorage keys: " + (storage.local.map(([k]) => k).join(", ") || "(none)"));
  console.log("  walkthrough sessionStorage keys: " + (storage.session.map(([k]) => k).join(", ") || "(none)"));
  console.log("  walkthrough indexedDB databases: " + (storage.databases.join(", ") || "(none)"));
}
