// Nav (Phase 7): the role-free header Primary nav (GooeyNav), logo and favicon, client-side transitions, old-route
// redirects, no role UI. GooeyNav renders each label twice (the second copy aria-hidden), so nav labels are always
// found by role and name, never by text.

export default async function nav({ baseUrl, accounts, assert, waitForWallet, newPage }) {
  const page = await newPage({ account: accounts.buyer });
  await page.goto(baseUrl + "/");
  await waitForWallet(page, accounts.buyer);

  const primary = page.locator("header").getByRole("navigation", { name: "Primary" });
  await page.locator('header img[alt="Opaquely"]').waitFor({ state: "visible", timeout: 25_000 });
  const icon = await page.locator('link[rel="icon"]').first().getAttribute("href");
  assert(icon && icon.includes("icon"), `expected an icon link, got ${icon}`);
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

  // The StaggeredMenu on the right lists every section, moves client-side and closes on link click and Escape.
  await menuChecks({ page, baseUrl, assert, waitForWallet, accounts });
}

async function menuChecks({ page, baseUrl, assert, waitForWallet, accounts }) {
  await page.goto(baseUrl + "/marketplace");
  await waitForWallet(page, accounts.buyer);
  const panel = page.locator("#staggered-menu-panel");
  assert((await panel.getAttribute("inert")) !== null, "the closed menu panel must be inert");
  const toggle = page.getByRole("button", { name: "Open menu" });
  await toggle.waitFor({ state: "visible", timeout: 25_000 });
  await toggle.click();
  for (const name of ["Home", "Upload", "Marketplace", "My Datasets", "My Account", "Transactions"]) {
    await panel.getByRole("link", { name, exact: true }).waitFor({ state: "visible", timeout: 10_000 });
  }
  await page.waitForFunction(() => document.activeElement && document.activeElement.textContent === "Home", null, {
    timeout: 5_000,
  });
  const github = panel.getByRole("link", { name: "GitHub" });
  assert((await github.getAttribute("target")) === "_blank", "GitHub link must open a new tab");
  assert(((await github.getAttribute("rel")) ?? "").includes("noopener"), "GitHub link rel must include noopener");

  await page.evaluate(() => {
    window.__menuMarker = 1;
  });
  await panel.getByRole("link", { name: "My Datasets", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/my-datasets", { timeout: 15_000 });
  assert((await page.evaluate(() => window.__menuMarker)) === 1, "menu navigation must be client-side");
  await page.getByRole("button", { name: "Open menu" }).waitFor({ state: "visible", timeout: 10_000 });

  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "Close menu" }).waitFor({ state: "visible", timeout: 10_000 });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open menu" }).waitFor({ state: "visible", timeout: 10_000 });
  assert((await panel.getAttribute("inert")) !== null, "the menu panel must be inert again after Escape");
}
