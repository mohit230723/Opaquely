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
}
