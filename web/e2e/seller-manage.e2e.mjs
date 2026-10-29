// Seller management: dashboard stats and withdraw, the datasets table, list-and-seal and the chain view.
// Stub state lives in page memory, so inside one flow the script uses in-app links and goBack, never
// page.goto after a write. Roles are always passed so the script passes with or without the seller guard.

const T = { timeout: 10_000 };
const LONG = { timeout: 25_000 };

async function openSeller(newPage, accounts, waitForWallet, baseUrl, path) {
  const page = await newPage({ account: accounts.seller, roles: { [accounts.seller]: "seller" } });
  await page.goto(baseUrl + path);
  await waitForWallet(page, accounts.seller);
  return page;
}

export default async function sellerManage({ baseUrl, accounts, assert, waitForWallet, newPage }) {
  // ---- dashboard: stats and a successful withdraw ----
  {
    const page = await openSeller(newPage, accounts, waitForWallet, baseUrl, "/sell");
    await page.getByText("Withdrawable balance").waitFor({ state: "visible", ...LONG });
    await page.getByText("0.06 ETH").waitFor({ state: "visible", ...T });
    await page.getByText("Held until withdrawn").waitFor({ state: "visible", ...T });

    const withdraw = page.getByRole("button", { name: "Withdraw balance" });
    await withdraw.click();
    await page.getByText("Transaction confirmed").waitFor({ state: "visible", ...T });
    await page.getByText("Nothing to withdraw yet.").waitFor({ state: "visible", ...T });
    assert(
      (await page.getByRole("button", { name: "Withdraw balance" }).getAttribute("aria-disabled")) === "true",
      "Withdraw balance must be disabled at a zero balance",
    );

    // Client-side navigation keeps the in-memory stub.
    await page.getByRole("navigation", { name: "Seller" }).getByRole("link", { name: "Datasets" }).click();
    await page.waitForURL((u) => u.pathname === "/sell/datasets", { timeout: 15_000 });
    await page.getByRole("heading", { name: "My datasets", level: 1 }).waitFor({ state: "visible", ...LONG });
    await page.getByText("Household utilities 2026").waitFor({ state: "visible", ...T });
    await page.getByText("Groceries Q3").waitFor({ state: "visible", ...T });
    await page.getByText("Medical and pharmacy").waitFor({ state: "visible", ...T });
    await page.getByText("Needs 3 bills").waitFor({ state: "visible", ...T });
  }

  // ---- withdraw failure and retry ----
  {
    const page = await openSeller(newPage, accounts, waitForWallet, baseUrl, "/sell");
    await page.getByText("Held until withdrawn").waitFor({ state: "visible", ...LONG });
    await page.getByLabel("Fail the next transaction (demo)").check();
    await page.getByRole("button", { name: "Withdraw balance" }).click();
    await page.getByText("Transaction failed").waitFor({ state: "visible", ...T });
    await page.getByText("Simulated failure: execution reverted.").waitFor({ state: "visible", ...T });
    await page.getByRole("button", { name: "Try again" }).click();
    await page.getByText("Transaction confirmed").waitFor({ state: "visible", ...T });
  }
  // ---- list and seal ----
  {
    const page = await openSeller(newPage, accounts, waitForWallet, baseUrl, "/sell/datasets/household-utilities-2026/list");
    await page.getByText("Add at least 3 bills before listing. This dataset has 1.").waitFor({ state: "visible", ...LONG });
    await page.getByRole("link", { name: "Add a bill" }).waitFor({ state: "visible", ...T });
    assert((await page.getByRole("button", { name: "List dataset" }).count()) === 0, "no List dataset action under the minimum");
  }
  {
    const page = await openSeller(newPage, accounts, waitForWallet, baseUrl, "/sell/datasets/groceries-q3/list");
    await page.getByRole("button", { name: "List dataset" }).waitFor({ state: "visible", ...LONG });
    await page.getByRole("button", { name: "List dataset" }).click();
    await page.getByText("Add a title (1 to 80 characters).").waitFor({ state: "visible", ...T });

    await page.getByLabel("Title").fill("Groceries Q3 insights");
    await page.getByLabel("Description").fill("Three weeks of grocery bills.");
    await page.getByLabel("Price (ETH)").fill("0");
    await page.getByLabel("Price (ETH)").blur();
    await page.getByText("Enter a price greater than 0 ETH.").waitFor({ state: "visible", ...T });
    await page.getByLabel("Price (ETH)").fill("0.05");
    await page.getByRole("button", { name: "List dataset" }).click();

    await page.getByText('List "Groceries Q3 insights"?').waitFor({ state: "visible", ...T });
    await page.getByText("Listing seals this dataset.").waitFor({ state: "visible", ...T });
    await page.getByRole("button", { name: "Seal and list dataset" }).click();
    await page.getByText("Transaction confirmed").waitFor({ state: "visible", ...T });
    await page.getByRole("button", { name: "View my datasets" }).click();
    await page.waitForURL((u) => u.pathname === "/sell/datasets", { timeout: 15_000 });
    const row = page.locator("tr", { hasText: "Groceries Q3" });
    await row.getByText("Listed").waitFor({ state: "visible", ...LONG });
    assert((await row.getByRole("link", { name: "Add bill" }).count()) === 0, "a listed dataset must not offer Add bill");
  }

  // ---- chain view ----
  {
    const page = await openSeller(newPage, accounts, waitForWallet, baseUrl, "/sell/datasets/groceries-q3/chain-view");
    for (const n of [1, 2, 3]) {
      await page.getByText("Bill " + n, { exact: true }).waitFor({ state: "visible", ...LONG });
    }
    assert((await page.getByText("Not available after reload").count()) === 3, "every bill must show Not available after reload");
    const handles = await page.locator('[title^="0x"]').evaluateAll((els) =>
      els.map((e) => e.getAttribute("title") ?? "").filter((t) => t.length === 66),
    );
    assert(handles.length >= 9, "expected at least 9 ciphertext handles, got " + handles.length);

    // Same page: an empty dataset shows the empty state.
    await page.getByRole("navigation", { name: "Seller" }).getByRole("link", { name: "Datasets" }).click();
    await page.waitForURL((u) => u.pathname === "/sell/datasets", { timeout: 15_000 });
    await page.getByRole("link", { name: "Create dataset" }).first().click();
    await page.waitForURL((u) => u.pathname === "/sell/datasets/new", { timeout: 15_000 });
    await page.getByLabel("Dataset name").fill("Empty one");
    await page.getByRole("button", { name: "Create dataset" }).click();
    await page.getByText("Dataset created.").waitFor({ state: "visible", ...T });
    await page.getByRole("link", { name: "Back to datasets" }).click();
    await page.waitForURL((u) => u.pathname === "/sell/datasets", { timeout: 15_000 });
    const empty = page.locator("tr", { hasText: "Empty one" });
    await empty.getByRole("link", { name: "Chain view" }).click();
    await page.getByText("No bills recorded yet").waitFor({ state: "visible", ...LONG });
  }
}
