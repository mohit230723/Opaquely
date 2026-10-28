// Create dataset: the first write runs through useTx and the TxStatus panel on the stub data layer.
// Roles are always passed so the script passes with or without the seller guard.

const T = { timeout: 10_000 };

export default async function createDataset({ baseUrl, accounts, assert, waitForWallet, newPage }) {
  const page = await newPage({ account: accounts.seller, roles: { [accounts.seller]: "seller" } });
  await page.goto(baseUrl + "/sell");
  await waitForWallet(page, accounts.seller);
  await page.getByText("Groceries Q3").waitFor({ state: "visible", timeout: 25_000 });

  // Client-side navigation keeps the in-memory stub.
  await page.getByRole("link", { name: "Create dataset" }).first().click();
  await page.waitForURL((u) => u.pathname === "/sell/datasets/new", { timeout: 15_000 });
  await page.getByRole("heading", { name: "New dataset" }).waitFor({ state: "visible", timeout: 25_000 });

  // An empty name is rejected inline and nothing is sent.
  await page.getByRole("button", { name: "Create dataset" }).click();
  await page.getByText("Give your dataset a name (1 to 60 characters).").waitFor({ state: "visible", ...T });
  assert((await page.getByText("Confirm in your wallet").count()) === 0, "an empty name must not start a transaction");

  await page.getByLabel("Dataset name").fill("E2E dataset");
  await page.getByRole("button", { name: "Create dataset" }).click();

  await page.getByText("Confirm in your wallet").waitFor({ state: "visible", ...T });
  const busyButton = page.getByRole("button", { name: "Create dataset" });
  assert((await busyButton.getAttribute("aria-busy")) === "true", "submit button must be aria-busy while a tx is in flight");
  await page.getByText("Transaction pending").waitFor({ state: "visible", ...T });
  await page.getByText("Transaction confirmed").waitFor({ state: "visible", ...T });
  await page.getByText("Dataset created.").waitFor({ state: "visible", ...T });

  const href = await page.getByRole("link", { name: "Add your first bill" }).getAttribute("href");
  assert(/^\/sell\/datasets\/.+\/add$/.test(href ?? ""), `unexpected "Add your first bill" href: ${href}`);

  // The new dataset shows on the dashboard after client-side navigation back.
  await page.goBack();
  await page.waitForURL((u) => u.pathname === "/sell", { timeout: 15_000 });
  await page.getByText("E2E dataset").waitFor({ state: "visible", timeout: 25_000 });
}
