// Smoke: header and Connect Wallet, the wallet gate, the seeded datasets on /my-datasets, old-route redirects.

export default async function smoke({ baseUrl, accounts, assert, waitForWallet, newPage }) {
  const anon = await newPage({ account: null });
  await anon.goto(baseUrl + "/");
  const logo = anon.locator("header").getByRole("link", { name: "Opaquely" });
  await logo.waitFor({ state: "visible", timeout: 25_000 });
  await anon.getByRole("button", { name: "Connect Wallet" }).first().waitFor({ state: "visible", timeout: 25_000 });

  // A disconnected visit to a wallet page shows the connect prompt in place and does not redirect.
  const stranger = await newPage({ account: null });
  await stranger.goto(baseUrl + "/upload");
  await stranger
    .getByRole("heading", { name: "Connect your wallet to continue" })
    .waitFor({ state: "visible", timeout: 25_000 });
  assert(new URL(stranger.url()).pathname === "/upload", `expected to stay on /upload, got ${stranger.url()}`);
  // The header logo goes home.
  await stranger.locator("header").getByRole("link", { name: "Opaquely" }).click();
  await stranger.waitForURL((u) => u.pathname === "/", { timeout: 15_000 });

  // Any connected wallet, nothing stored: /my-datasets lists the seeded datasets through the DataLayer.
  const page = await newPage({ account: accounts.seller });
  await page.goto(baseUrl + "/my-datasets");
  await waitForWallet(page, accounts.seller);
  const main = page.locator("main");
  await main.getByText("Groceries Q3").waitFor({ state: "visible", timeout: 25_000 });
  await main.getByText("Medical and pharmacy").waitFor({ state: "visible", timeout: 25_000 });
  assert(
    (await main.getByText("Household utilities 2026").count()) === 1,
    "expected the third seeded dataset once on /my-datasets",
  );

  // Reconnect race regression: after a reload the wallet page stays put and loads again.
  await page.reload();
  await page.waitForTimeout(6_000);
  assert(new URL(page.url()).pathname === "/my-datasets", `expected to stay on /my-datasets after reload, got ${page.url()}`);
  await main.getByText("Groceries Q3").waitFor({ state: "visible", timeout: 25_000 });

  // Old routes redirect to the new pages.
  for (const [from, to] of [
    ["/role", "/"],
    ["/sell", "/account"],
    ["/buy", "/marketplace"],
  ]) {
    await page.goto(baseUrl + from);
    const landed = new URL(page.url()).pathname;
    assert(landed === to, `expected ${from} to redirect to ${to}, got ${landed}`);
  }

  // No role chooser anywhere.
  for (const path of ["/", "/marketplace"]) {
    await page.goto(baseUrl + path);
    await page.waitForTimeout(1_000);
    assert((await page.getByRole("radiogroup", { name: "Role" }).count()) === 0, `no Role radiogroup expected on ${path}`);
  }
}
