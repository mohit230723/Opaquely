// Landing: the hero (size, live WebGL2 context), the CTAs, and the "How it works" explainer.

const STEPS = [
  ["Upload", "Add a bill photo. It stays in your browser."],
  ["OCR", "Text is read on your device. Nothing goes to a server."],
  ["Encrypt", "Amount, category and date are encrypted before they leave."],
  ["Compute", "The contract adds up encrypted totals without decrypting."],
  ["List", "Seal the dataset and set a price in test ETH."],
  ["Buy", "Buyers pay once and get access to the aggregates only."],
];

export default async function landing({ baseUrl, accounts, assert, waitForWallet, newPage }) {
  // Disconnected, 1280x900.
  const anon = await newPage({ account: null, viewport: { width: 1280, height: 900 } });
  await anon.goto(baseUrl + "/");
  const canvas = anon.locator("canvas.gradient-ascii-canvas");
  await canvas.waitFor({ state: "attached", timeout: 25_000 });
  const box = await canvas.boundingBox();
  assert(box !== null, "hero canvas has no bounding box");
  assert(Math.abs(box.height - 600) <= 1, `hero canvas height should be 600, got ${box.height}`);
  assert(Math.abs(box.width - 1280) <= 1, `hero canvas width should be 1280, got ${box.width}`);

  await anon.waitForTimeout(3_000);
  const lost = await anon.evaluate(() => {
    const gl = document.querySelector("canvas.gradient-ascii-canvas")?.getContext("webgl2");
    return gl ? gl.isContextLost() : "no-context";
  });
  assert(lost === false, `expected a live WebGL2 context (isContextLost() === false), got ${lost}`);

  await anon.getByRole("heading", { level: 1, name: "Your bills, encrypted. Insights, for sale." }).waitFor({ state: "visible", timeout: 10_000 });

  // WALL-01: the hero carries its own Connect Wallet button while disconnected (the header has one too).
  const heroConnect = anon.locator("section").first().getByRole("button", { name: "Connect Wallet" });
  await heroConnect.waitFor({ state: "visible", timeout: 25_000 });

  // LAND-02: the hero CTAs are plain links to Upload and the Marketplace.
  const hero = anon.locator("section").first();
  assert((await hero.getByRole("link", { name: "Upload" }).getAttribute("href")) === "/upload", "hero Upload must link to /upload");
  assert(
    (await hero.getByRole("link", { name: "Browse marketplace" }).getAttribute("href")) === "/marketplace",
    "hero Browse marketplace must link to /marketplace",
  );

  // LAND-02: "How it works" lists the six steps with their lines.
  await anon.getByRole("heading", { name: "How it works" }).waitFor({ state: "visible", timeout: 10_000 });
  for (const [title, line] of STEPS) {
    await anon.getByRole("heading", { name: title, exact: true }).waitFor({ state: "attached", timeout: 10_000 });
    await anon.getByText(line, { exact: true }).waitFor({ state: "attached", timeout: 10_000 });
  }
  assert((await anon.locator("ol > li").count()) === 6, "expected six steps in the ordered list");

  // A connected wallet with nothing stored goes straight to the Marketplace (no role chooser).
  const buyer = await newPage({ account: accounts.buyer });
  await buyer.goto(baseUrl + "/");
  await waitForWallet(buyer, accounts.buyer);
  await buyer.locator("section").first().getByRole("link", { name: "Browse marketplace" }).click();
  await buyer.waitForURL((u) => u.pathname === "/marketplace", { timeout: 15_000 });
}
