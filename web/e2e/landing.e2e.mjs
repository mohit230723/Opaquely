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

  // LAND-02: the CTA opens the RainbowKit modal when disconnected.
  await anon.getByRole("button", { name: "Start selling" }).click();
  await anon.getByRole("dialog").getByText("Connect a Wallet").waitFor({ state: "visible", timeout: 15_000 });
  await anon.keyboard.press("Escape");

  // LAND-02: "How it works" lists the six steps with their lines.
  await anon.getByRole("heading", { name: "How it works" }).waitFor({ state: "visible", timeout: 10_000 });
  for (const [title, line] of STEPS) {
    await anon.getByRole("heading", { name: title, exact: true }).waitFor({ state: "attached", timeout: 10_000 });
    await anon.getByText(line, { exact: true }).waitFor({ state: "attached", timeout: 10_000 });
  }
  assert((await anon.locator("ol > li").count()) === 6, "expected six steps in the ordered list");

  // Connected seller with a stored seller role goes straight to /sell.
  const seller = await newPage({ account: accounts.seller, roles: { [accounts.seller]: "seller" } });
  await seller.goto(baseUrl + "/");
  await waitForWallet(seller, accounts.seller);
  await seller.getByRole("button", { name: "Start selling" }).click();
  await seller.waitForURL((u) => u.pathname === "/sell", { timeout: 15_000 });

  // Connected buyer account with no stored role is sent to the chooser.
  const buyer = await newPage({ account: accounts.buyer });
  await buyer.goto(baseUrl + "/");
  await waitForWallet(buyer, accounts.buyer);
  await buyer.getByRole("button", { name: "Browse datasets" }).click();
  await buyer.waitForURL((u) => u.pathname === "/role", { timeout: 15_000 });
}
