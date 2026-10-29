// Reduced motion: the hero draws one static frame; without it the hero animates. The menu opens without tweens.

export default async function reducedMotion({ baseUrl, assert, newPage }) {
  const still = await newPage({ account: null, reducedMotion: true, viewport: { width: 1280, height: 900 } });
  await still.goto(baseUrl + "/");
  const stillCanvas = still.locator("canvas.gradient-ascii-canvas");
  await stillCanvas.waitFor({ state: "visible", timeout: 25_000 });
  await still.waitForTimeout(3_000);
  const a = await stillCanvas.screenshot();
  await still.waitForTimeout(1_500);
  const b = await stillCanvas.screenshot();
  assert(a.equals(b), "with reduced motion the hero must be a static frame (two screenshots 1.5 s apart differ)");

  const moving = await newPage({ account: null, reducedMotion: false, viewport: { width: 1280, height: 900 } });
  await moving.goto(baseUrl + "/");
  const movingCanvas = moving.locator("canvas.gradient-ascii-canvas");
  await movingCanvas.waitFor({ state: "visible", timeout: 25_000 });
  // Past the 2.4 s intro.
  await moving.waitForTimeout(3_000);
  const c = await movingCanvas.screenshot();
  await moving.waitForTimeout(1_500);
  const d = await movingCanvas.screenshot();
  assert(!c.equals(d), "without reduced motion the hero must animate (two screenshots 1.5 s apart are identical)");

  // Reduced motion: the menu opens instantly (no GSAP timeline) and Escape closes it.
  const menu = await newPage({ account: null, reducedMotion: true, viewport: { width: 1280, height: 900 } });
  await menu.goto(baseUrl + "/");
  await menu.getByRole("button", { name: "Open menu" }).waitFor({ state: "visible", timeout: 25_000 });
  await menu.getByRole("button", { name: "Open menu" }).click();
  await menu
    .locator("#staggered-menu-panel")
    .getByRole("link", { name: "Upload", exact: true })
    .waitFor({ state: "visible", timeout: 500 });
  await menu.getByRole("button", { name: "Close menu" }).waitFor({ state: "visible", timeout: 500 });
  await menu.keyboard.press("Escape");
  await menu.getByRole("button", { name: "Open menu" }).waitFor({ state: "visible", timeout: 5_000 });
}
