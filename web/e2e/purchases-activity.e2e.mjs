// Buyer side of My Datasets (Bought by me, View Analytics placeholder) and the Transactions timeline on
// My Account, plus the empty wallet and the disconnected visit. No role anywhere.
// Stub state lives in page memory, so inside one flow the script uses in-app links, never page.goto after a write.
// Every lookup is scoped to header, main, a section or a card: the footer repeats the nav names.

const T = { timeout: 10_000 };
const LONG = { timeout: 25_000 };

export default async function purchasesActivity({ baseUrl, accounts, assert, waitForWallet, newPage }) {
  // ---- populated purchases, populated activity, then the empty wallet ----
  {
    const page = await newPage({ account: accounts.buyer });
    await page.goto(baseUrl + "/my-datasets");
    await waitForWallet(page, accounts.buyer);
    const main = page.locator("main");
    const nav = page.locator("header").getByRole("navigation", { name: "Primary" });

    await main.getByRole("heading", { name: "My Datasets", level: 1 }).waitFor({ state: "visible", ...LONG });
    const bought = main.locator("section", { has: page.getByRole("heading", { name: "Bought by me", level: 2 }) });
    const card = bought.getByTestId("bought-dataset").first();
    await card.waitFor({ state: "visible", ...LONG });
    await card.getByText("Weekly groceries from 40 families").waitFor({ state: "visible", ...T });
    await card.getByText("Access granted", { exact: true }).waitFor({ state: "visible", ...T });
    await card.getByText(/^Paid 0\.05 ETH$/).waitFor({ state: "visible", ...T });
    const analytics = card.getByRole("button", { name: "View Analytics" });
    await analytics.waitFor({ state: "visible", ...T });
    assert((await analytics.getAttribute("aria-disabled")) === "true", "View Analytics must be aria-disabled");
    await card.getByText("Coming in Milestone 2.").waitFor({ state: "visible", ...T });
    const helperId = await analytics.getAttribute("aria-describedby");
    assert(Boolean(helperId), "View Analytics must point at its helper text");
    assert(
      (await card.locator(`[id="${helperId}"]`).innerText()).trim() === "Coming in Milestone 2.",
      "the described-by helper must say Coming in Milestone 2.",
    );
    // A press does nothing: the placeholder never shows an analytics number or leaves the page.
    // force: Playwright treats aria-disabled as disabled and would otherwise wait for it to enable.
    await analytics.click({ force: true });
    await page.waitForTimeout(300);
    assert(new URL(page.url()).pathname === "/my-datasets", "View Analytics must not navigate");
    assert((await bought.locator("ul").count()) === 1, "Bought by me is a ul of cards");

    await nav.getByRole("link", { name: "My Account" }).click();
    await page.waitForURL((u) => u.pathname === "/account", { timeout: 15_000 });
    await main.getByRole("heading", { name: "My Account", level: 1 }).waitFor({ state: "visible", ...LONG });
    // Transactions holds only this wallet's history: its own listings, purchases and withdrawals, plus purchases
    // of its own listing by other wallets. Another wallet's listing never shows up here.
    const transactions = main.locator("section", { has: page.getByRole("heading", { name: "Transactions", level: 2 }) });
    await transactions.getByText("Your listings, sales, purchases and withdrawals.").waitFor({ state: "visible", ...T });
    await transactions.getByText(/^You bought /).first().waitFor({ state: "visible", ...LONG });
    await transactions.getByText(/^You listed /).first().waitFor({ state: "visible", ...T });
    const items = await transactions.locator("ol > li").allTextContents();
    assert(items.length >= 3, "the timeline must show several events");
    assert(
      items.some((t) => t.startsWith("You bought ")),
      `the buyer's timeline must hold its purchase, got: ${items.join(" | ")}`,
    );
    for (const t of items) {
      const mine = t.startsWith("You ");
      const saleOfMine = /^0x[0-9a-fA-F]{4}…[0-9a-fA-F]{4} bought "Medical and pharmacy spend, 4 bills"/.test(t);
      assert(mine || saleOfMine, `the buyer's timeline must hold only its own events and sales of its listing, got: ${t}`);
    }
    assert((await transactions.getByText("Show more transactions").count()) === 0, "no Show more under 20 transactions");

    await page.locator("footer").getByLabel("Start from an empty wallet (demo)").check();
    await transactions.getByText("No activity yet").waitFor({ state: "visible", ...LONG });
    await transactions.getByText("Listings, purchases and withdrawals show up here.").waitFor({ state: "visible", ...T });
    assert((await main.locator("ol > li").count()) === 0, "an empty timeline must not render a rail");
    // Every account stat stays on screen at zero.
    await main.getByText("Nothing to withdraw yet.").waitFor({ state: "visible", ...T });
    for (const label of ["Total earned", "Withdrawable balance", "Withdrawn so far", "Datasets", "Listings", "Sales", "Bought", "Total spent"]) {
      await main.getByText(label, { exact: true }).waitFor({ state: "visible", ...T });
    }

    await nav.getByRole("link", { name: "My Datasets" }).click();
    await page.waitForURL((u) => u.pathname === "/my-datasets", { timeout: 15_000 });
    await bought.getByText("No purchases yet").waitFor({ state: "visible", ...LONG });
    const browse = bought.getByRole("link", { name: "Browse marketplace" });
    await browse.waitFor({ state: "visible", ...T });
    assert((await browse.getAttribute("href")) === "/marketplace", "Browse marketplace must go to /marketplace");
  }

  // ---- a failed read on My Account shows Could not load with Try again ----
  // Data may already be cached, so the one-shot read failure is armed on Home, which reads nothing, and then the
  // Primary My Account link is followed: the first read the page starts (the account stats) is the one that fails,
  // while Transactions loads on its own.
  {
    const page = await newPage({ account: accounts.buyer });
    await page.goto(baseUrl + "/");
    await waitForWallet(page, accounts.buyer);
    const main = page.locator("main");
    const nav = page.locator("header").getByRole("navigation", { name: "Primary" });
    await page.locator("footer").getByLabel("Fail the next read (demo)").check();
    await nav.getByRole("link", { name: "My Account" }).click();
    await page.waitForURL((u) => u.pathname === "/account", { timeout: 15_000 });
    const error = main.getByRole("alert").filter({ hasText: "Could not load your account" });
    await error.waitFor({ state: "visible", ...LONG });
    await error.getByText("Something went wrong while reading data. Try again.").waitFor({ state: "visible", ...T });
    await main.getByText(/^You bought /).first().waitFor({ state: "visible", ...LONG });
    await error.getByRole("button", { name: "Try again" }).click();
    await error.waitFor({ state: "detached", ...LONG });
    await main.getByText("Held until withdrawn").waitFor({ state: "visible", ...LONG });
  }

  // ---- a disconnected visit shows the connect prompt in place ----
  {
    const page = await newPage({ account: null });
    await page.goto(baseUrl + "/account");
    await page.getByRole("heading", { name: "Connect your wallet to continue" }).waitFor({ state: "visible", ...LONG });
    assert(new URL(page.url()).pathname === "/account", "a disconnected visit must stay on /account");
  }
}
