// Seller management on the Phase 7 pages (stub, no role): withdraw on /account, the Listed by me cards on
// /my-datasets (Sold for, buyers, drafts), and listing a seeded draft through Continue in Upload.
// Stub state lives in page memory, so inside one flow the script uses in-app links, never page.goto after a
// write. Every lookup is scoped to header, main, a section, a card or the dialog: the footer repeats the nav names.

const T = { timeout: 10_000 };
const LONG = { timeout: 25_000 };

async function openSeller(newPage, accounts, waitForWallet, baseUrl, path) {
  const page = await newPage({ account: accounts.seller });
  await page.goto(baseUrl + path);
  await waitForWallet(page, accounts.seller);
  return page;
}

function listedCard(page, name) {
  return page.locator("main").getByTestId("listed-dataset").filter({ hasText: name });
}

async function goMyDatasets(page) {
  await page.locator("header").getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "My Datasets" }).click();
  await page.waitForURL((u) => u.pathname === "/my-datasets", { timeout: 15_000 });
  await page.locator("main").getByRole("heading", { name: "Listed by me", level: 2 }).waitFor({ state: "visible", ...LONG });
}

export default async function sellerManage({ baseUrl, accounts, assert, waitForWallet, newPage }) {
  // ---- /account: stats and a successful withdraw, then the cards on /my-datasets and listing a draft ----
  {
    const page = await openSeller(newPage, accounts, waitForWallet, baseUrl, "/account");
    const main = page.locator("main");
    await main.getByText("Withdrawable balance").waitFor({ state: "visible", ...LONG });
    await main.getByText("0.06 ETH").first().waitFor({ state: "visible", ...T });
    await main.getByText("Held until withdrawn").waitFor({ state: "visible", ...T });

    await main.getByRole("button", { name: "Withdraw balance" }).click();
    await main.getByText("Transaction confirmed").waitFor({ state: "visible", ...LONG });
    await main.getByText("Nothing to withdraw yet.").waitFor({ state: "visible", ...T });
    assert(
      (await main.getByRole("button", { name: "Withdraw balance" }).getAttribute("aria-disabled")) === "true",
      "Withdraw balance must be disabled at a zero balance",
    );

    // Client-side navigation keeps the in-memory stub.
    await goMyDatasets(page);
    for (const name of ["Household utilities 2026", "Groceries Q3", "Medical and pharmacy"]) {
      await listedCard(page, name).waitFor({ state: "visible", ...LONG });
    }
    assert((await main.locator("ul").getByTestId("listed-dataset").count()) === 3, "three listed-by-me cards in a ul");

    // The listed seeded dataset has two sales at 0.03 ETH.
    const sold = listedCard(page, "Medical and pharmacy");
    await sold.getByText("Sold for 0.06 ETH").waitFor({ state: "visible", ...LONG });
    await sold.getByText("2 buyers at 0.03 ETH each").waitFor({ state: "visible", ...T });
    await sold.getByText("Sold", { exact: true }).waitFor({ state: "visible", ...T });
    await sold.getByText("Price 0.03 ETH").waitFor({ state: "visible", ...T });
    await sold.getByText("4 bills").waitFor({ state: "visible", ...T });
    assert((await sold.getByRole("link", { name: "Continue in Upload" }).count()) === 0, "a listed dataset has no Continue in Upload");

    // A draft under the minimum.
    const draft = listedCard(page, "Household utilities 2026");
    await draft.getByText("Draft", { exact: true }).waitFor({ state: "visible", ...T });
    await draft.getByText("1 of 3 bills").waitFor({ state: "visible", ...T });
    await draft.getByText("1 bill", { exact: true }).waitFor({ state: "visible", ...T });
    const draftLink = draft.getByRole("link", { name: "Continue in Upload" });
    await draftLink.waitFor({ state: "visible", ...T });
    assert(
      (await draftLink.getAttribute("href")) === "/upload?dataset=household-utilities-2026",
      "Continue in Upload must resume the draft on /upload",
    );

    // List the seeded draft that has 3 bills.
    const groceries = listedCard(page, "Groceries Q3");
    await groceries.getByText("3 of 3 bills").waitFor({ state: "visible", ...T });
    await groceries.getByRole("link", { name: "Continue in Upload" }).click();
    await page.waitForURL((u) => u.pathname === "/upload" && u.searchParams.get("dataset") === "groceries-q3", { timeout: 15_000 });
    await main.getByRole("heading", { level: 2, name: "Describe your dataset" }).waitFor({ state: "visible", ...LONG });
    await page.waitForFunction(
      () => document.querySelector('main input[name="dataset-name"]')?.value === "Groceries Q3",
      null,
      T,
    );
    assert((await main.getByLabel("Dataset name").getAttribute("readonly")) !== null, "a resumed draft's name is read-only");

    // The chain rows for the resumed dataset: 3 bills, none entered in this tab.
    const step3 = main.locator("section", { has: page.getByRole("heading", { level: 2, name: "Encrypted bills" }) });
    for (const n of [1, 2, 3]) {
      await step3.getByRole("heading", { level: 3, name: "Bill " + n }).waitFor({ state: "visible", ...LONG });
    }
    assert((await step3.getByText("Not available after reload").count()) === 3, "every bill must show Not available after reload");
    const handles = await step3.locator('[title^="0x"]').evaluateAll((els) =>
      els.map((e) => e.getAttribute("title") ?? "").filter((t) => t.length === 66),
    );
    assert(handles.length >= 9, "expected at least 9 ciphertext handles, got " + handles.length);

    // A resumed draft starts with an empty description; then the price.
    await main.getByLabel("Description").fill("Three weeks of grocery bills.");
    const price = main.getByLabel("Price (ETH)");
    await price.fill("0");
    await price.blur();
    await main.getByText("Enter a price greater than 0 ETH.").waitFor({ state: "visible", ...T });
    await price.fill("0.05");
    await main.getByText("Enter a price greater than 0 ETH.").waitFor({ state: "detached", ...T });
    await main.getByRole("button", { name: "List to Marketplace", exact: true }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("heading", { name: 'List "Groceries Q3"?' }).waitFor({ state: "visible", ...T });
    await dialog.getByText("Listing seals this dataset.").waitFor({ state: "visible", ...T });
    await dialog.getByRole("button", { name: "List to Marketplace", exact: true }).click();
    await dialog.getByText("Transaction confirmed").waitFor({ state: "visible", ...LONG });
    await page.waitForURL((u) => u.pathname === "/marketplace", { timeout: 15_000 });

    // Back on My Datasets, the card is Listed and offers no Continue in Upload.
    await goMyDatasets(page);
    const listed = listedCard(page, "Groceries Q3");
    await listed.getByText("Listed", { exact: true }).waitFor({ state: "visible", ...LONG });
    await listed.getByText("Price 0.05 ETH").waitFor({ state: "visible", ...T });
    assert((await listed.getByRole("link", { name: "Continue in Upload" }).count()) === 0, "a listed dataset has no Continue in Upload");
  }

  // ---- withdraw failure and retry ----
  {
    const page = await openSeller(newPage, accounts, waitForWallet, baseUrl, "/account");
    const main = page.locator("main");
    await main.getByText("Held until withdrawn").waitFor({ state: "visible", ...LONG });
    await page.locator("footer").getByLabel("Fail the next transaction (demo)").check();
    await main.getByRole("button", { name: "Withdraw balance" }).click();
    await main.getByText("Transaction failed").waitFor({ state: "visible", ...LONG });
    await main.getByText("Simulated failure: execution reverted.").waitFor({ state: "visible", ...T });
    await main.getByRole("button", { name: "Try again" }).click();
    await main.getByText("Transaction confirmed").waitFor({ state: "visible", ...LONG });
  }

  // ---- a draft under the minimum, opened from its card ----
  {
    const page = await openSeller(newPage, accounts, waitForWallet, baseUrl, "/my-datasets");
    const main = page.locator("main");
    const draft = listedCard(page, "Household utilities 2026");
    await draft.waitFor({ state: "visible", ...LONG });
    await draft.getByRole("link", { name: "Continue in Upload" }).click();
    await page.waitForURL((u) => u.pathname === "/upload", { timeout: 15_000 });
    await main.getByText("Add at least 3 bills before listing. This dataset has 1.").waitFor({ state: "visible", ...LONG });
    // Amendment A1: the button is present but blocked under the minimum.
    const list = main.getByRole("button", { name: "List to Marketplace", exact: true });
    assert((await list.getAttribute("aria-disabled")) === "true", "List to Marketplace must be blocked under 3 bills");
    const step3 = main.locator("section", { has: page.getByRole("heading", { level: 2, name: "Encrypted bills" }) });
    await step3.getByRole("heading", { level: 3, name: "Bill 1" }).waitFor({ state: "visible", ...T });
    await step3.getByText("Not available after reload").first().waitFor({ state: "visible", ...T });
  }
}
