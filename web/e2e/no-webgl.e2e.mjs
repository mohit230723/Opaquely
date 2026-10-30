// No WebGL (Phase 7, D-13): with every WebGL context refused, the nav, the Upload page's Encrypt button and the
// purchase dialog still work with the flat fallback look and no page error. With WebGL, a visible unblocked button
// goes live.

const NO_WEBGL = `(() => {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...args) {
    if (type === "webgl2" || type === "webgl" || type === "experimental-webgl") return null;
    return original.call(this, type, ...args);
  };
})();`;

export default async function noWebgl({ baseUrl, accounts, assert, waitForWallet, newPage }) {
  const page = await newPage({ account: accounts.seller });
  await page.context().addInitScript({ content: NO_WEBGL });

  // Home: the Primary nav and the hero Upload link are there and named.
  await page.goto(baseUrl + "/");
  await waitForWallet(page, accounts.seller);
  const primary = page.locator("header").getByRole("navigation", { name: "Primary" });
  for (const name of ["Upload", "Marketplace", "My Datasets", "My Account"]) {
    await primary.getByRole("link", { name }).waitFor({ state: "visible", timeout: 25_000 });
  }
  await page.locator("section").first().getByRole("link", { name: "Upload" }).waitFor({ state: "visible", timeout: 10_000 });

  // Upload: Encrypt is flat, named and blocked until step 1 is filled; the review form still validates.
  await page.goto(baseUrl + "/upload");
  const main = page.locator("main");
  const encrypt = main.getByRole("button", { name: "Encrypt", exact: true });
  await encrypt.waitFor({ state: "visible", timeout: 25_000 });
  await page.waitForTimeout(1_000);
  assert((await encrypt.getAttribute("data-gl")) === "off", "without WebGL the button must stay data-gl=off");
  assert((await encrypt.getAttribute("aria-disabled")) === "true", "Encrypt must be aria-disabled before step 1 is filled");
  await main.getByText("Add a name and description first.").waitFor({ state: "visible", timeout: 10_000 });
  await main.getByLabel("Dataset name").fill("No WebGL dataset");
  await main.getByLabel("Description").fill("Bills read without WebGL.");
  await main.getByText("Add a name and description first.").waitFor({ state: "detached", timeout: 10_000 });
  // The bill fields are still empty, so the button stays blocked for that reason (Phase 1 review-form contract);
  // Enter in a bill field shows every review error.
  await main.getByText("Enter an amount, a date and a category to continue.").waitFor({ state: "visible", timeout: 10_000 });
  await main.getByLabel("Total amount").press("Enter");
  await main.getByText("Enter an amount greater than 0.").waitFor({ state: "visible", timeout: 10_000 });
  await fillBill(main);
  await page.waitForFunction(
    () => {
      const b = [...document.querySelectorAll("main button")].find((el) => el.textContent?.trim() === "Encrypt");
      return b && !b.hasAttribute("aria-disabled");
    },
    null,
    { timeout: 10_000 },
  );
  assert((await encrypt.getAttribute("data-gl")) === "off", "an unblocked Encrypt must still be flat without WebGL");

  // Marketplace: open the first listing and open the purchase dialog.
  await page.goto(baseUrl + "/marketplace");
  const first = page.locator('a[href^="/marketplace/listing-"]').first();
  await first.waitFor({ state: "visible", timeout: 25_000 });
  await first.click();
  await page.waitForURL((u) => u.pathname.startsWith("/marketplace/listing-"), { timeout: 15_000 });
  const buy = page.locator("main").getByRole("button", { name: /^Buy (this )?dataset$/ }).first();
  await buy.waitFor({ state: "visible", timeout: 25_000 });
  await buy.click();
  await page.getByRole("dialog").getByText("Confirm purchase").first().waitFor({ state: "visible", timeout: 10_000 });

  // With WebGL available, Encrypt gets a live context once it is unblocked (a blocked button never takes one).
  const normal = await newPage({ account: accounts.seller });
  await normal.goto(baseUrl + "/upload");
  const normalMain = normal.locator("main");
  const live = normalMain.getByRole("button", { name: "Encrypt", exact: true });
  await live.waitFor({ state: "visible", timeout: 25_000 });
  await normalMain.getByLabel("Dataset name").fill("WebGL dataset");
  await normalMain.getByLabel("Description").fill("Bills read with WebGL.");
  await fillBill(normalMain);
  await live.scrollIntoViewIfNeeded();
  await normal.waitForFunction(
    () => {
      const b = [...document.querySelectorAll("main button")].find((el) => el.textContent?.trim() === "Encrypt");
      return b?.getAttribute("data-gl") === "on";
    },
    null,
    { timeout: 5_000 },
  );
  const liveCount = await normal.evaluate(() => document.querySelectorAll('[data-gl="on"]').length);
  assert(liveCount <= 8, `at most 8 live button contexts, got ${liveCount}`);
}

/** Types a valid bill into the review form (no OCR: this script is about the buttons). */
async function fillBill(main) {
  await main.getByLabel("Total amount").fill("120.00");
  await main.getByLabel("Date").fill("2026-10-01");
  await main.getByRole("radio", { name: "Utilities" }).click();
}
