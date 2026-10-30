// Marketplace: the GlowCard grid, buying from a card, the detail page. Stub state lives in page memory, so
// inside one flow the script uses in-app links and goBack, never page.goto after a write.
// Every link and button lookup is scoped to header, main, a dialog or a card: the footer repeats the nav names.

const T = { timeout: 10_000 };
const LONG = { timeout: 25_000 };

async function open(newPage, account, waitForWallet, baseUrl, path, opts = {}) {
  const page = await newPage({ account, ...opts });
  await page.goto(baseUrl + path);
  await waitForWallet(page, account);
  return page;
}

const cards = (page) => page.locator("main").locator('li[data-testid="listing-card"]');

/** A card this wallet can buy: not its own listing and not already bought. */
const buyableCard = (page) =>
  cards(page).filter({ hasNotText: "Your listing" }).filter({ hasNotText: "Access granted" }).first();

export default async function buyerMarket({ baseUrl, accounts, assert, waitForWallet, newPage }) {
  // ---- tracer: buy straight from a card, the card flips to Access granted ----
  {
    const page = await open(newPage, accounts.buyer, waitForWallet, baseUrl, "/marketplace");
    const main = page.locator("main");
    await main.getByText(/^Showing \d+ of \d+ datasets?$/).waitFor({ state: "visible", ...LONG });

    const card = buyableCard(page);
    await card.waitFor({ state: "visible", ...LONG });
    const title = ((await card.getByRole("link").first().textContent()) ?? "").trim();
    assert(title.length > 0, "the buyable card must have a title link");

    await card.getByRole("button", { name: "Buy this dataset" }).click();
    const dialog = page.getByRole("dialog", { name: "Confirm purchase" });
    await dialog.waitFor({ state: "visible", ...T });
    await dialog.getByText("This cannot be refunded or revoked.", { exact: false }).waitFor({ state: "visible", ...T });
    await dialog.getByRole("button", { name: /^Pay .* ETH$/ }).click();
    // Under SwiftShader a full grid of live specular buttons slows the page, so the receipt wait is long.
    await dialog.getByText("Transaction confirmed").waitFor({ state: "visible", ...LONG });
    await dialog.getByText("Access granted.", { exact: true }).waitFor({ state: "visible", ...T });
    await dialog.getByRole("button", { name: "View my datasets" }).waitFor({ state: "visible", ...T });
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden", ...T });

    const same = cards(page).filter({ has: page.getByRole("link", { name: title, exact: true }) });
    await same.getByText("Access granted", { exact: true }).waitFor({ state: "visible", ...T });
    assert((await same.getByRole("button", { name: "Buy this dataset" }).count()) === 0, "a bought card must not offer Buy");
    await same.getByRole("link", { name: "View in My Datasets" }).waitFor({ state: "visible", ...T });
  }
}
