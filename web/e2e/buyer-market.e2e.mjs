// Buyer marketplace: browse, search and filter, detail, and buying. Stub state lives in page memory,
// so inside one flow the script uses in-app links and goBack, never page.goto after a write.
// Roles are always passed so the script passes with or without the buyer guard.

const T = { timeout: 10_000 };
const LONG = { timeout: 25_000 };

async function openBuyer(newPage, accounts, waitForWallet, baseUrl, path) {
  const page = await newPage({ account: accounts.buyer, roles: { [accounts.buyer]: "buyer" } });
  await page.goto(baseUrl + path);
  await waitForWallet(page, accounts.buyer);
  return page;
}

export default async function buyerMarket({ baseUrl, accounts, assert, waitForWallet, newPage }) {
  // ---- browse, search and filter ----
  {
    const page = await openBuyer(newPage, accounts, waitForWallet, baseUrl, "/buy");
    await page.getByText("Showing 6 of 6 datasets").waitFor({ state: "visible", ...LONG });
    assert((await page.getByText("Your listing", { exact: true }).count()) === 1, "exactly one card must show Your listing");

    const search = page.getByLabel("Search");
    await search.fill("Weekly groceries");
    await page.getByText("Showing 1 of 6 datasets").waitFor({ state: "visible", ...T });

    await search.fill("zzzz-no-match");
    await page.getByText("No datasets match your filters").waitFor({ state: "visible", ...T });
    await page.getByRole("button", { name: "Clear filters" }).last().click();
    await page.getByText("Showing 6 of 6 datasets").waitFor({ state: "visible", ...T });

    const min = page.getByLabel("Min price (ETH)");
    await min.fill("abc");
    await page.getByText("Enter a valid ETH amount.").waitFor({ state: "visible", ...T });
    await page.getByText("Showing 6 of 6 datasets").waitFor({ state: "visible", ...T });
    await min.fill("0.2");
    await page.getByText("Showing 1 of 6 datasets").waitFor({ state: "visible", ...T });
    assert((await page.getByText("0.25 ETH").count()) === 1, "the only card must show 0.25 ETH");

    await page.getByRole("button", { name: "Clear filters" }).first().click();
    await page.getByText("Showing 6 of 6 datasets").waitFor({ state: "visible", ...T });
    await page.getByRole("checkbox", { name: "Medical" }).click();
    await page.getByText("Showing 2 of 6 datasets").waitFor({ state: "visible", ...T });
  }

  // ---- the seller role is sent to /role ----
  {
    const page = await newPage({ account: accounts.seller, roles: { [accounts.seller]: "seller" } });
    await page.goto(baseUrl + "/buy");
    await page.waitForURL((u) => u.pathname === "/role", { timeout: 25_000 });
  }
}
