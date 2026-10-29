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

  // A listing detail keeps Marketplace current.
  const firstListing = page.locator('a[href^="/marketplace/listing-"]').first();
  await firstListing.waitFor({ state: "visible", timeout: 25_000 });
  const listingHref = await firstListing.getAttribute("href");
  const listingId = listingHref.split("/")[2];
  await firstListing.click();
  await page.waitForURL((u) => u.pathname === listingHref, { timeout: 15_000 });
  assert((await marketplace.getAttribute("aria-current")) === "page", "Marketplace should stay current on a listing page");

  // On / no Primary nav link is current.
  await primary.getByRole("link", { name: "Upload" }).waitFor({ state: "visible", timeout: 10_000 });
  await page.locator("header").getByRole("link", { name: "Opaquely" }).click();
  await page.waitForURL((u) => u.pathname === "/", { timeout: 15_000 });
  for (const name of ["Upload", "Marketplace", "My Datasets", "My Account"]) {
    assert((await primary.getByRole("link", { name }).getAttribute("aria-current")) === null, `${name} must not be current on /`);
  }

  // Every old route lands on its new page.
  const redirects = [
    ["/sell/datasets/new", "/upload"],
    ["/sell/datasets", "/my-datasets"],
    ["/sell", "/account"],
    ["/buy/purchases", "/my-datasets"],
    [`/buy/${listingId}`, `/marketplace/${listingId}`],
    ["/buy", "/marketplace"],
    ["/activity", "/account"],
    ["/role", "/"],
  ];
  for (const [from, to] of redirects) {
    await page.goto(baseUrl + from);
    const landed = new URL(page.url()).pathname;
    assert(landed === to, `expected ${from} to redirect to ${to}, got ${landed}`);
  }

  // After the whole flow the app has stored nothing of its own.
  const ownKeys = await page.evaluate(() =>
    [...Object.keys(localStorage), ...Object.keys(sessionStorage)].filter((k) => k.toLowerCase().startsWith("opaquely")),
  );
  assert(ownKeys.length === 0, `no opaquely* storage key expected, got ${ownKeys.join(", ")}`);
}
