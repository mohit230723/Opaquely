// Smoke: header and Connect Wallet, the guarded /sell area, and the role chooser.

const SELLER_KEY = "opaquely:role:0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";

export default async function smoke({ baseUrl, accounts, assert, waitForWallet, newPage }) {
  // Disconnected: / is a 404 inside the root layout until the landing page exists (plan 01-05),
  // so assert on the header only, which every later plan keeps.
  const anon = await newPage({ account: null });
  await anon.goto(baseUrl + "/");
  await anon.locator("header").getByRole("link", { name: "Opaquely" }).waitFor({ state: "visible", timeout: 25_000 });
  await anon.getByRole("button", { name: "Connect Wallet" }).first().waitFor({ state: "visible", timeout: 25_000 });

  // WALL-04: a disconnected visit to /sell ends on "/" (the guard redirects once wagmi has settled).
  const stranger = await newPage({ account: null });
  await stranger.goto(baseUrl + "/sell");
  await stranger.waitForURL((u) => u.pathname === "/", { timeout: 15_000 });

  // Connected seller with a stored seller role: /sell lists the seeded datasets through the DataLayer.
  const page = await newPage({ account: accounts.seller, roles: { [accounts.seller]: "seller" } });
  await page.goto(baseUrl + "/sell");
  await waitForWallet(page, accounts.seller);
  await page.getByText("Groceries Q3").waitFor({ state: "visible", timeout: 25_000 });
  await page.getByText("Medical and pharmacy").waitFor({ state: "visible", timeout: 25_000 });
  assert((await page.getByText("Household utilities 2026").count()) === 1, "expected the third seeded dataset on /sell");

  // Reconnect race regression: after a reload the seller must stay on /sell, never bounce to "/".
  await page.reload();
  await page.waitForTimeout(6_000);
  assert(new URL(page.url()).pathname === "/sell", `expected to stay on /sell after reload, got ${page.url()}`);
  await page.getByText("Groceries Q3").waitFor({ state: "visible", timeout: 25_000 });

  // A connected wallet whose stored role is buyer is sent to the chooser when it opens /sell.
  const buyer = await newPage({ account: accounts.seller, roles: { [accounts.seller]: "buyer" } });
  await buyer.goto(baseUrl + "/sell");
  await buyer.waitForURL((u) => u.pathname === "/role", { timeout: 15_000 });

  // WALL-03: with no stored role, /sell lands on the chooser; the choice persists and can be changed.
  const fresh = await newPage({ account: accounts.seller });
  await fresh.goto(baseUrl + "/sell");
  await fresh.waitForURL((u) => u.pathname === "/role", { timeout: 15_000 });
  await fresh.getByRole("heading", { name: "Choose your role" }).waitFor({ state: "visible", timeout: 25_000 });
  await fresh.getByRole("radiogroup").waitFor({ state: "visible", timeout: 25_000 });
  await fresh.getByRole("button", { name: "Continue as Seller" }).click();
  await fresh.waitForURL((u) => u.pathname === "/sell", { timeout: 15_000 });
  await fresh.getByText("Groceries Q3").waitFor({ state: "visible", timeout: 25_000 });
  const stored = await fresh.evaluate((k) => localStorage.getItem(k), SELLER_KEY);
  assert(stored === "seller", `expected stored role "seller", got ${stored}`);

  // Choosing again changes the role; arrow keys move the radio selection.
  // Same page, no pre-seeded role: nothing re-writes the stored value on navigation.
  const again = fresh;
  await again.goto(baseUrl + "/role");
  await again.getByRole("heading", { name: "Choose your role" }).waitFor({ state: "visible", timeout: 25_000 });
  await again.getByText("Current role").waitFor({ state: "visible", timeout: 10_000 });
  const sellerRadio = again.getByRole("radio", { name: /Seller/ });
  assert((await sellerRadio.getAttribute("aria-checked")) === "true", "expected Seller radio checked");
  await sellerRadio.focus();
  await again.keyboard.press("ArrowRight");
  const buyerRadio = again.getByRole("radio", { name: /Buyer/ });
  assert((await buyerRadio.getAttribute("aria-checked")) === "true", "expected Buyer radio checked after ArrowRight");
  await again.getByRole("button", { name: "Continue as Buyer" }).click();
  await again.waitForURL((u) => u.pathname === "/buy", { timeout: 15_000 });
  const changed = await again.evaluate((k) => localStorage.getItem(k), SELLER_KEY);
  assert(changed === "buyer", `expected stored role "buyer", got ${changed}`);
}
