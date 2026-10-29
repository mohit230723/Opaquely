// No WebGL (Phase 7, D-13): with every WebGL context refused, the nav, the specular buttons and the purchase
// dialog still work with the flat fallback look and no page error. With WebGL, a visible button goes live.

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

  // Upload: the primary submit button is flat, named and clickable; an empty submit shows the validation text.
  await page.goto(baseUrl + "/upload");
  const submit = page.locator("main").getByRole("button", { name: "Create dataset" });
  await submit.waitFor({ state: "visible", timeout: 25_000 });
  await page.waitForTimeout(1_000);
  assert((await submit.getAttribute("data-gl")) === "off", "without WebGL the button must stay data-gl=off");
  await submit.click();
  await page.getByText("Give your dataset a name (1 to 60 characters).").first().waitFor({ state: "visible", timeout: 10_000 });

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

  // With WebGL available, the visible primary button gets a live context.
  const normal = await newPage({ account: accounts.seller });
  await normal.goto(baseUrl + "/upload");
  const live = normal.locator("main").getByRole("button", { name: "Create dataset" });
  await live.waitFor({ state: "visible", timeout: 25_000 });
  await normal.waitForFunction(
    () => {
      const b = [...document.querySelectorAll("main button")].find((el) => el.textContent?.includes("Create dataset"));
      return b?.getAttribute("data-gl") === "on";
    },
    null,
    { timeout: 5_000 },
  );
  const liveCount = await normal.evaluate(() => document.querySelectorAll('[data-gl="on"]').length);
  assert(liveCount <= 8, `at most 8 live button contexts, got ${liveCount}`);
}
