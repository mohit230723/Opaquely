// Walking-skeleton smoke: header and Connect Wallet are there, and a connected wallet reads its datasets.

export default async function smoke({ baseUrl, accounts, assert, waitForWallet, newPage }) {
  // Disconnected: / is a 404 inside the root layout until the landing page exists (plan 01-05),
  // so assert on the header only, which every later plan keeps.
  const anon = await newPage({ account: null });
  await anon.goto(baseUrl + "/");
  await anon.locator("header").getByRole("link", { name: "Opaquely" }).waitFor({ state: "visible", timeout: 25_000 });
  await anon.getByRole("button", { name: "Connect Wallet" }).first().waitFor({ state: "visible", timeout: 25_000 });

  // Connected as the seller: /sell lists the seeded datasets read through the DataLayer.
  const page = await newPage({ account: accounts.seller });
  await page.goto(baseUrl + "/sell");
  await waitForWallet(page, accounts.seller);
  await page.getByText("Groceries Q3").waitFor({ state: "visible", timeout: 25_000 });
  await page.getByText("Medical and pharmacy").waitFor({ state: "visible", timeout: 25_000 });
  assert((await page.getByText("Household utilities 2026").count()) === 1, "expected the third seeded dataset on /sell");
}
