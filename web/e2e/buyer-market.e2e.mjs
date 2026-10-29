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

  // ---- detail pages: already bought, own listing, buying ----
  const buyable = (page) =>
    page
      .locator('a[href^="/buy/listing-"]')
      .filter({ hasNotText: "Your listing" })
      .filter({ hasNotText: "Weekly groceries from 40 families" })
      .first();

  {
    const page = await openBuyer(newPage, accounts, waitForWallet, baseUrl, "/buy");
    await page.getByText("Showing 6 of 6 datasets").waitFor({ state: "visible", ...LONG });

    await page.getByRole("link", { name: /Weekly groceries from 40 families/ }).click();
    await page.getByRole("heading", { name: "Weekly groceries from 40 families", level: 1 }).waitFor({ state: "visible", ...LONG });
    // The closed purchase dialog repeats part of the wording, so match the whole promise sentence.
    const promise = page.getByText("You get encrypted aggregate insights, not raw bills. One-time, permanent access.", { exact: true });
    await promise.waitFor({ state: "visible", ...T });
    const promiseText = ((await promise.textContent()) ?? "").toLowerCase();
    assert(promiseText.includes("encrypted aggregate insights, not raw bills"), "promise must say encrypted aggregate insights, not raw bills");
    assert(promiseText.includes("one-time, permanent access"), "promise must say one-time, permanent access");
    await page.getByText("What you get", { exact: true }).waitFor({ state: "visible", ...T });
    await page.getByText("6 category totals", { exact: true }).waitFor({ state: "visible", ...T });
    await page.getByText("What you do not get", { exact: true }).waitFor({ state: "visible", ...T });
    await page.getByText("Raw bills", { exact: true }).waitFor({ state: "visible", ...T });
    await page.getByText("Access granted", { exact: true }).waitFor({ state: "visible", ...LONG });
    const decrypt = page.getByRole("button", { name: "Decrypt insights (coming in M2)" });
    await decrypt.waitFor({ state: "visible", ...T });
    assert((await decrypt.getAttribute("aria-disabled")) === "true", "the decrypt action must be disabled");
    assert((await page.getByRole("button", { name: "Buy dataset" }).count()) === 0, "an owned listing must not offer Buy dataset");

    await page.goBack();
    await page.getByText("Showing 6 of 6 datasets").waitFor({ state: "visible", ...LONG });
    await page.getByRole("link", { name: /Your listing/ }).click();
    await page.getByText("This is your listing. You cannot buy it.").waitFor({ state: "visible", ...LONG });
    const own = page.getByRole("button", { name: "Buy dataset" });
    assert((await own.getAttribute("aria-disabled")) === "true", "Buy dataset must be disabled on an own listing");

    await page.goBack();
    await page.getByText("Showing 6 of 6 datasets").waitFor({ state: "visible", ...LONG });
    await buyable(page).click();
    await page.getByRole("button", { name: "Buy dataset" }).click();
    await page.getByText("Confirm purchase", { exact: true }).waitFor({ state: "visible", ...T });
    await page.getByText("This cannot be refunded or revoked.").waitFor({ state: "visible", ...T });
    await page.getByRole("button", { name: /^Pay .* ETH$/ }).click();
    await page.getByText("Transaction confirmed").waitFor({ state: "visible", ...T });
    await page.getByText("Access granted.", { exact: true }).waitFor({ state: "visible", ...T });
    await page.getByRole("button", { name: "View my purchases" }).waitFor({ state: "visible", ...T });
  }

  // ---- a failed purchase can be retried ----
  {
    const page = await openBuyer(newPage, accounts, waitForWallet, baseUrl, "/buy");
    await page.getByText("Showing 6 of 6 datasets").waitFor({ state: "visible", ...LONG });
    await page.getByLabel("Fail the next transaction (demo)").check();
    await buyable(page).click();
    await page.getByRole("button", { name: "Buy dataset" }).click();
    await page.getByRole("button", { name: /^Pay .* ETH$/ }).click();
    await page.getByText("Transaction failed").waitFor({ state: "visible", ...T });
    await page.getByText("Simulated failure: execution reverted.").waitFor({ state: "visible", ...T });
    await page.getByRole("button", { name: "Try again" }).click();
    await page.getByText("Transaction confirmed").waitFor({ state: "visible", ...T });
  }

  // ---- an unknown listing ----
  {
    const page = await openBuyer(newPage, accounts, waitForWallet, baseUrl, "/buy/does-not-exist");
    await page.getByText("Listing not found").waitFor({ state: "visible", ...LONG });
  }

  // ---- the seller role is sent to /role ----
  {
    const page = await newPage({ account: accounts.seller, roles: { [accounts.seller]: "seller" } });
    await page.goto(baseUrl + "/buy");
    await page.waitForURL((u) => u.pathname === "/role", { timeout: 25_000 });
  }
}
