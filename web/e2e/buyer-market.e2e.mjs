// Marketplace: the GlowCard grid, its states, buying from a card, the detail page. Stub state lives in page
// memory, so inside one flow the script uses in-app links and goBack, never page.goto after a write.
// Every link and button lookup is scoped to header, main, a dialog or a card: the footer repeats the nav names.

const T = { timeout: 10_000 };
const LONG = { timeout: 25_000 };
const SHOWING = /^Showing \d+ of \d+ datasets?$/;

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

const cardByTitle = (page, title) => cards(page).filter({ has: page.getByRole("link", { name: title, exact: true }) });

export default async function buyerMarket({ baseUrl, accounts, assert, waitForWallet, newPage }) {
  // ---- tracer: buy straight from a card, the card flips to Access granted ----
  {
    const page = await open(newPage, accounts.buyer, waitForWallet, baseUrl, "/marketplace");
    const main = page.locator("main");
    await main.getByText(SHOWING).waitFor({ state: "visible", ...LONG });
    await main.getByRole("heading", { name: "Marketplace", level: 1 }).waitFor({ state: "visible", ...T });
    await main
      .getByText("Encrypted datasets from other sellers. Buyers get insights, never single bills.", { exact: true })
      .waitFor({ state: "visible", ...T });

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

    const same = cardByTitle(page, title);
    await same.getByText("Access granted", { exact: true }).waitFor({ state: "visible", ...T });
    assert((await same.getByRole("button", { name: "Buy this dataset" }).count()) === 0, "a bought card must not offer Buy");
    await same.getByRole("link", { name: "View in My Datasets" }).waitFor({ state: "visible", ...T });
  }

  // ---- grid contents, filters and the filtered-empty state ----
  {
    const page = await open(newPage, accounts.buyer, waitForWallet, baseUrl, "/marketplace", {
      viewport: { width: 1280, height: 900 },
    });
    const main = page.locator("main");
    await main.getByText("Showing 6 of 6 datasets").waitFor({ state: "visible", ...LONG });
    assert((await cards(page).count()) === 6, "six listing cards");
    // The stub seeds one listing for every connected wallet, so the buyer has exactly one own card.
    assert((await main.getByText("Your listing", { exact: true }).count()) === 1, "exactly one card must show Your listing");

    // Every card: the title is the only link and it points at the detail page; price and bills sit in the card.
    const n = await cards(page).count();
    for (let i = 0; i < n; i++) {
      const c = cards(page).nth(i);
      const links = c.getByRole("link");
      const hrefs = await links.evaluateAll((els) => els.map((e) => e.getAttribute("href")));
      const detail = hrefs.filter((h) => h && h.startsWith("/marketplace/listing-"));
      assert(detail.length === 1, `card ${i} must have exactly one title link to /marketplace/listing-…, got ${hrefs.join(",")}`);
      const text = await c.innerText();
      assert(/\d+ bills?\b/.test(text), `card ${i} must show a bill count`);
      assert(/\d+(\.\d+)? ETH/.test(text), `card ${i} must show a price`);
    }
    // The already-bought seed listing shows Access granted and no Buy.
    const groceries = cardByTitle(page, "Weekly groceries from 40 families");
    await groceries.getByText("Access granted", { exact: true }).waitFor({ state: "visible", ...T });
    assert((await groceries.getByRole("button", { name: "Buy this dataset" }).count()) === 0, "a bought card must not offer Buy");
    const groceriesText = await groceries.innerText();
    assert(/\d+ bills?\b/.test(groceriesText) && /ETH/.test(groceriesText), "price and bills come from the card container");

    // WebGL budget on a populated grid: after scrolling through, at most 8 live specular contexts.
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(400);
    await page.mouse.wheel(0, -2000);
    await page.waitForTimeout(400);
    const live = await page.evaluate(() => document.querySelectorAll('[data-gl="on"]').length);
    assert(live <= 8, `at most 8 elements may carry data-gl=on, got ${live}`);

    // A normal card's width, measured before narrowing.
    const normalBox = await cards(page).first().boundingBox();
    assert(normalBox !== null, "a card has no bounding box");

    const search = main.getByLabel("Search");
    await search.fill("Weekly groceries");
    await main.getByText("Showing 1 of 6 datasets").waitFor({ state: "visible", ...T });
    const loneBox = await cards(page).first().boundingBox();
    assert(loneBox !== null, "the lone card has no bounding box");
    assert(Math.abs(loneBox.width - normalBox.width) <= 10, `a lone card must stay card-width: ${loneBox.width} vs ${normalBox.width}`);

    await search.fill("zzzz-no-match");
    await main.getByText("No datasets match your filters").waitFor({ state: "visible", ...T });
    await main.getByText("Try a different search or clear the filters.").waitFor({ state: "visible", ...T });
    assert((await cards(page).count()) === 0, "no cards when everything is filtered out");
    await main.getByRole("button", { name: "Clear filters" }).last().click();
    await main.getByText("Showing 6 of 6 datasets").waitFor({ state: "visible", ...T });

    const min = main.getByLabel("Min price (ETH)");
    await min.fill("abc");
    await main.getByText("Enter a valid ETH amount.").waitFor({ state: "visible", ...T });
    await main.getByText("Showing 6 of 6 datasets").waitFor({ state: "visible", ...T });
    await min.fill("0.2");
    await main.getByText("Showing 1 of 6 datasets").waitFor({ state: "visible", ...T });
    assert((await cards(page).filter({ hasText: "0.25 ETH" }).count()) === 1, "the only card must show 0.25 ETH");
    await main.getByRole("button", { name: "Clear filters" }).first().click();
    await main.getByText("Showing 6 of 6 datasets").waitFor({ state: "visible", ...T });

    const max = main.getByLabel("Max price (ETH)");
    await max.fill("0.02");
    await main.getByText("Showing 2 of 6 datasets").waitFor({ state: "visible", ...T });
    await main.getByRole("button", { name: "Clear filters" }).first().click();
    await main.getByText("Showing 6 of 6 datasets").waitFor({ state: "visible", ...T });

    await main.getByRole("checkbox", { name: "Medical" }).click();
    await main.getByText("Showing 2 of 6 datasets").waitFor({ state: "visible", ...T });
    assert((await cards(page).count()) === 2, "the category chip leaves two cards");
    await main.getByRole("button", { name: "Clear filters" }).first().click();
    await main.getByText("Showing 6 of 6 datasets").waitFor({ state: "visible", ...T });

    // ---- detail page through the title link ----
    await groceries.getByRole("link", { name: "Weekly groceries from 40 families", exact: true }).click();
    await page.waitForURL((u) => u.pathname.startsWith("/marketplace/listing-"), { timeout: 15_000 });
    await main.getByRole("heading", { name: "Weekly groceries from 40 families", level: 1 }).waitFor({ state: "visible", ...LONG });
    // The closed purchase dialog repeats part of the wording, so match the whole promise sentence.
    const promise = main.getByText("You get encrypted aggregate insights, not raw bills. One-time, permanent access.", { exact: true });
    await promise.waitFor({ state: "visible", ...T });
    await main.getByText("What you get", { exact: true }).waitFor({ state: "visible", ...T });
    await main.getByText("6 category totals", { exact: true }).waitFor({ state: "visible", ...T });
    await main.getByText("What you do not get", { exact: true }).waitFor({ state: "visible", ...T });
    await main.getByText("Raw bills", { exact: true }).waitFor({ state: "visible", ...T });
    await main.getByText("Access granted", { exact: true }).waitFor({ state: "visible", ...LONG });
    const decrypt = main.getByRole("button", { name: "Decrypt insights (coming in M2)" });
    await decrypt.waitFor({ state: "visible", ...T });
    assert((await decrypt.getAttribute("aria-disabled")) === "true", "the decrypt action must be disabled");
    assert((await main.getByRole("button", { name: "Buy this dataset" }).count()) === 0, "an owned listing must not offer Buy");

    // Another listing's detail page offers Buy this dataset and buys through the same dialog.
    await page.goBack();
    await main.getByText("Showing 6 of 6 datasets").waitFor({ state: "visible", ...LONG });
    await buyableCard(page).getByRole("link").first().click();
    await page.waitForURL((u) => u.pathname.startsWith("/marketplace/listing-"), { timeout: 15_000 });
    await main.getByRole("button", { name: "Buy this dataset" }).click();
    const dialog = page.getByRole("dialog", { name: "Confirm purchase" });
    await dialog.getByText("This cannot be refunded or revoked.", { exact: false }).waitFor({ state: "visible", ...T });
    await dialog.getByRole("button", { name: "Back to listing" }).click();
    await dialog.waitFor({ state: "hidden", ...T });
  }

  // ---- a failed purchase from a card can be retried ----
  {
    const page = await open(newPage, accounts.buyer, waitForWallet, baseUrl, "/marketplace");
    await page.locator("main").getByText(SHOWING).waitFor({ state: "visible", ...LONG });
    await page.locator("footer").getByLabel("Fail the next transaction (demo)").check();
    await buyableCard(page).getByRole("button", { name: "Buy this dataset" }).click();
    const dialog = page.getByRole("dialog", { name: "Confirm purchase" });
    await dialog.getByRole("button", { name: /^Pay .* ETH$/ }).click();
    await dialog.getByText("Transaction failed").waitFor({ state: "visible", ...LONG });
    await dialog.getByText("Simulated failure: execution reverted.").waitFor({ state: "visible", ...T });
    await dialog.getByRole("button", { name: "Try again" }).click();
    await dialog.getByText("Transaction confirmed").waitFor({ state: "visible", ...LONG });
  }

  // ---- a failed first read shows the error state with Try again; the empty wallet shows the empty state ----
  {
    // Home has no data reads, so the one-shot read failure lands on the marketplace's first read (listings),
    // not on a refresh of data already on screen.
    const page = await open(newPage, accounts.buyer, waitForWallet, baseUrl, "/");
    const main = page.locator("main");
    const nav = page.locator("header").getByRole("navigation", { name: "Primary" });
    await page.locator("footer").getByLabel("Fail the next read (demo)").check();
    await nav.getByRole("link", { name: "Marketplace" }).click();
    await page.waitForURL((u) => u.pathname === "/marketplace", { timeout: 15_000 });
    await main.getByText("Could not load datasets").waitFor({ state: "visible", ...LONG });
    await main.getByRole("button", { name: "Try again" }).click();
    await main.getByText(SHOWING).waitFor({ state: "visible", ...LONG });
    assert((await main.getByText("Could not load datasets").count()) === 0, "the error state must go after Try again");

    await page.locator("footer").getByLabel("Start from an empty wallet (demo)").check();
    await main.getByText("No datasets for sale yet").waitFor({ state: "visible", ...LONG });
    await main.getByText("Sellers list their encrypted datasets here. Check back soon.").waitFor({ state: "visible", ...T });
    assert((await cards(page).count()) === 0, "no cards in the empty marketplace");
    const upload = main.getByRole("link", { name: "Upload" });
    assert((await upload.getAttribute("href")) === "/upload", "the empty state's Upload action goes to /upload");
  }

  // ---- an unknown listing ----
  {
    const page = await open(newPage, accounts.buyer, waitForWallet, baseUrl, "/marketplace/listing-does-not-exist");
    const main = page.locator("main");
    await main.getByText("Listing not found").waitFor({ state: "visible", ...LONG });
    await main.getByText("It may have been removed. Browse the available datasets.").waitFor({ state: "visible", ...T });
    assert(
      (await main.getByRole("link", { name: "Browse marketplace" }).getAttribute("href")) === "/marketplace",
      "Browse marketplace goes to /marketplace",
    );
  }

  // ---- the seller sees Your listing on the own card, with no Buy inside it ----
  {
    const page = await open(newPage, accounts.seller, waitForWallet, baseUrl, "/marketplace");
    const main = page.locator("main");
    await main.getByText(SHOWING).waitFor({ state: "visible", ...LONG });
    const own = cards(page).filter({ hasText: "Your listing" });
    await own.first().waitFor({ state: "visible", ...LONG });
    assert((await own.count()) >= 1, "the seller must see at least one own card");
    for (let i = 0; i < (await own.count()); i++) {
      assert((await own.nth(i).getByRole("button", { name: "Buy this dataset" }).count()) === 0, "an own card must not offer Buy");
    }
    // The own listing's detail page keeps the disabled Buy with the reason.
    await own.first().getByRole("link").first().click();
    await main.getByText("This is your listing. You cannot buy it.").waitFor({ state: "visible", ...LONG });
    const buy = main.getByRole("button", { name: "Buy this dataset" });
    assert((await buy.getAttribute("aria-disabled")) === "true", "Buy this dataset must be disabled on an own listing");
  }
}
