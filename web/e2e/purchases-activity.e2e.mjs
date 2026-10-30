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
    await main.getByText(/^You bought /).first().waitFor({ state: "visible", ...LONG });
    await main.getByText(/^You listed /).first().waitFor({ state: "visible", ...T });
    assert((await main.locator("ol > li").count()) >= 3, "the timeline must show several events");

    await page.locator("footer").getByLabel("Start from an empty wallet (demo)").check();
    await main.getByText("No activity yet").waitFor({ state: "visible", ...LONG });
    assert((await main.locator("ol > li").count()) === 0, "an empty timeline must not render a rail");

    await nav.getByRole("link", { name: "My Datasets" }).click();
    await page.waitForURL((u) => u.pathname === "/my-datasets", { timeout: 15_000 });
    await bought.getByText("No purchases yet").waitFor({ state: "visible", ...LONG });
    const browse = bought.getByRole("link", { name: "Browse marketplace" });
    await browse.waitFor({ state: "visible", ...T });
    assert((await browse.getAttribute("href")) === "/marketplace", "Browse marketplace must go to /marketplace");
  }

  // ---- a disconnected visit shows the connect prompt in place ----
  {
    const page = await newPage({ account: null });
    await page.goto(baseUrl + "/account");
    await page.getByRole("heading", { name: "Connect your wallet to continue" }).waitFor({ state: "visible", ...LONG });
    assert(new URL(page.url()).pathname === "/account", "a disconnected visit must stay on /account");
  }
}
