// Nav (Phase 7): the role-free header Primary nav, client-side transitions, old-route redirects, no role UI.

export default async function nav({ baseUrl, accounts, assert, waitForWallet, newPage }) {
  const page = await newPage({ account: accounts.buyer });
  await page.goto(baseUrl + "/");
  await waitForWallet(page, accounts.buyer);

  const primary = page.locator("header").getByRole("navigation", { name: "Primary" });
  const marketplace = primary.getByRole("link", { name: "Marketplace" });
  await marketplace.waitFor({ state: "visible", timeout: 25_000 });

  // A marker on window survives only a client-side transition.
  await page.evaluate(() => {
    window.__navMarker = 1;
  });
  await marketplace.click();
  await page.waitForURL((u) => u.pathname === "/marketplace", { timeout: 15_000 });
  assert((await marketplace.getAttribute("aria-current")) === "page", "Marketplace should be the current nav item");
  await page.getByText(/^Showing \d+ of \d+ datasets?$/).waitFor({ state: "visible", timeout: 25_000 });
  const marker = await page.evaluate(() => window.__navMarker);
  assert(marker === 1, `expected a client-side transition (marker 1), got ${marker}`);
}
