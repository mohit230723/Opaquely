// Buyer purchases and the shared activity timeline, plus their guards.
// Stub state lives in page memory, so inside one flow the script uses in-app links, never page.goto after a write.

const T = { timeout: 10_000 };
const LONG = { timeout: 25_000 };

export default async function purchasesActivity({ baseUrl, accounts, assert, waitForWallet, newPage }) {
  // ---- populated purchases, populated activity, then the empty wallet ----
  {
    const page = await newPage({ account: accounts.buyer, roles: { [accounts.buyer]: "buyer" } });
    await page.goto(baseUrl + "/buy/purchases");
    await waitForWallet(page, accounts.buyer);

    await page.getByRole("heading", { name: "My purchases", level: 1 }).waitFor({ state: "visible", ...LONG });
    await page.getByText("Weekly groceries from 40 families").first().waitFor({ state: "visible", ...LONG });
    await page.getByText("Access granted", { exact: true }).waitFor({ state: "visible", ...T });
    await page.getByText("Decryption arrives in Milestone 2.").first().waitFor({ state: "visible", ...T });
    const decrypt = page.getByRole("button", { name: "Decrypt insights (coming in M2)" });
    await decrypt.waitFor({ state: "visible", ...T });
    assert((await decrypt.getAttribute("aria-disabled")) === "true", "the decrypt action must be disabled");
    await page.getByText(/^Paid 0\.05 ETH$/).waitFor({ state: "visible", ...T });

    await page.getByRole("navigation", { name: "Buyer" }).getByRole("link", { name: "Activity" }).click();
    await page.waitForURL((u) => u.pathname === "/activity", { timeout: 15_000 });
    await page.getByRole("heading", { name: "Activity", level: 1 }).waitFor({ state: "visible", ...LONG });
    await page.getByText(/^You bought /).first().waitFor({ state: "visible", ...LONG });
    await page.getByText(/^You listed /).first().waitFor({ state: "visible", ...T });
    assert((await page.locator("ol > li").count()) >= 3, "the timeline must show several events");

    await page.getByLabel("Start from an empty wallet (demo)").check();
    await page.getByText("No activity yet").waitFor({ state: "visible", ...LONG });
    assert((await page.locator("ol > li").count()) === 0, "an empty timeline must not render a rail");

    await page.getByRole("navigation", { name: "Buyer" }).getByRole("link", { name: "My purchases" }).click();
    await page.getByText("No purchases yet").waitFor({ state: "visible", ...LONG });
    await page.getByRole("link", { name: "Browse datasets" }).waitFor({ state: "visible", ...T });
  }

  // ---- a disconnected visit lands on / ----
  {
    const page = await newPage({});
    await page.goto(baseUrl + "/activity");
    await page.waitForURL((u) => u.pathname === "/", { timeout: 25_000 });
  }

  // ---- connected without a stored role lands on /role ----
  {
    const page = await newPage({ account: accounts.buyer });
    await page.goto(baseUrl + "/activity");
    await page.waitForURL((u) => u.pathname === "/role", { timeout: 25_000 });
  }

  // ---- the seller can open /activity and sees the seller nav ----
  {
    const page = await newPage({ account: accounts.seller, roles: { [accounts.seller]: "seller" } });
    await page.goto(baseUrl + "/activity");
    await waitForWallet(page, accounts.seller);
    await page.getByRole("heading", { name: "Activity", level: 1 }).waitFor({ state: "visible", ...LONG });
    assert((await page.getByRole("navigation", { name: "Seller" }).count()) === 1, "the seller nav must be shown");
    assert(new URL(page.url()).pathname === "/activity", "the seller must stay on /activity");
  }
}
