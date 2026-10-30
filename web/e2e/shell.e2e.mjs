// App shell: network badge, wrong-network gate and switch, the Primary nav, stub footer toggles, footer position, 360px.

const T = { timeout: 10_000 };
const LONG = { timeout: 25_000 };

export default async function shell({ baseUrl, accounts, assert, waitForWallet, newPage }) {
  // ---- Disconnected: the mode badge is on every page ----
  {
    const page = await newPage();
    await page.goto(baseUrl + "/");
    await page.getByTestId("network-badge").getByText("Local FHEVM mock").waitFor({ state: "visible", ...LONG });
    const title = await page.getByTestId("network-badge").getAttribute("title");
    assert(/simulated, not real FHE/.test(title ?? ""), `badge title must say encryption is simulated, got: ${title}`);
    assert((await page.getByText(/Sepolia, real FHE/).count()) === 0, "local mode must never claim real FHE");
  }

  // ---- Wrong network: wallet on Ethereum mainnet ----
  {
    const page = await newPage({ account: accounts.seller, chainId: 1 });
    await page.goto(baseUrl + "/my-datasets");
    // RainbowKit shows "Wrong network" instead of the address on an unsupported chain, so wait for the gate itself.
    const alert = page.getByRole("alert").filter({ hasText: "Wrong network" });
    await alert.waitFor({ state: "visible", ...LONG });
    await alert.getByText("Your wallet is on Ethereum").waitFor({ state: "visible", ...T });
    assert(
      (await page.getByTestId("network-badge").innerText()).includes("Wrong network"),
      "badge must read Wrong network on chain 1",
    );
    const inert = await page.getByTestId("gated-main").getAttribute("inert");
    assert(inert !== null, "the element wrapping main must be inert on the wrong network");
    assert((await page.getByTestId("gated-main").getAttribute("aria-hidden")) === "true", "gated main must be aria-hidden");

    await alert.getByRole("button", { name: "Switch to Hardhat" }).click();
    await alert.waitFor({ state: "detached", ...T });
    await page.getByTestId("network-badge").getByText("Local FHEVM mock").waitFor({ state: "visible", ...T });
    await page.getByText("Groceries Q3").waitFor({ state: "visible", ...LONG });
    assert((await page.getByTestId("gated-main").getAttribute("inert")) === null, "main must not be inert after the switch");
  }

  // ---- Primary nav, footer, demo toggles ----
  {
    const page = await newPage({ account: accounts.seller });
    await page.goto(baseUrl + "/account");
    await waitForWallet(page, accounts.seller);
    await page.getByText("Held until withdrawn").waitFor({ state: "visible", ...LONG });

    // The skip link is the first focusable element.
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement && document.activeElement.textContent);
    assert((focused ?? "").trim() === "Skip to content", `first Tab stop must be the skip link, got: ${focused}`);

    const nav = page.locator("header").getByRole("navigation", { name: "Primary" });
    for (const name of ["Upload", "Marketplace", "My Datasets", "My Account"]) {
      await nav.getByRole("link", { name }).waitFor({ state: "visible", ...T });
    }
    assert(
      (await nav.getByRole("link", { name: "My Account" }).getAttribute("aria-current")) === "page",
      "My Account must be marked aria-current=page on /account",
    );
    assert(
      (await nav.getByRole("link", { name: "Upload" }).getAttribute("aria-current")) === null,
      "Upload must not be active on /account",
    );
    await page.locator("footer").getByText("Simulated data and transactions. Nothing is sent to a chain yet.").waitFor({ state: "visible", ...T });

    // Fail the next transaction: one failure, then Try again confirms.
    await page.getByLabel("Fail the next transaction (demo)").check();
    await page.getByRole("button", { name: "Withdraw balance" }).click();
    await page.getByText("Transaction failed").waitFor({ state: "visible", ...T });
    await page.getByText("Simulated failure: execution reverted.").waitFor({ state: "visible", ...T });
    await page.getByRole("button", { name: "Try again" }).waitFor({ state: "visible", ...T });

    // Fail the next read on /my-datasets. Its two sections load independently, and the Sold line reads activity
    // outside them (a failed activity read is silent by design). My Account also reads the wallet's datasets, so
    // this step opens a fresh tab with nothing cached: the failure is armed on Home, which reads nothing, and the
    // first read My Datasets starts (Listed by me) is the one that fails: that section shows its error with Try
    // again while Bought by me still renders.
    const fresh = await newPage({ account: accounts.seller });
    await fresh.goto(baseUrl + "/");
    await waitForWallet(fresh, accounts.seller);
    await fresh.locator("footer").getByLabel("Fail the next read (demo)").check();
    await fresh.locator("header").getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "My Datasets" }).click();
    await fresh.waitForURL((u) => u.pathname === "/my-datasets", { timeout: 15_000 });
    const main = fresh.locator("main");
    const listed = main.locator("section", { has: fresh.getByRole("heading", { name: "Listed by me", level: 2 }) });
    const bought = main.locator("section", { has: fresh.getByRole("heading", { name: "Bought by me", level: 2 }) });
    await listed.getByText(/Could not load|Couldn't refresh/).first().waitFor({ state: "visible", ...LONG });
    await listed.getByText("Could not load your datasets").waitFor({ state: "visible", ...T });
    await bought.getByTestId("bought-dataset").first().waitFor({ state: "visible", ...LONG });
    await listed.getByRole("button", { name: "Try again" }).click();
    await listed.getByText(/Could not load|Couldn't refresh/).first().waitFor({ state: "detached", ...T });
    await listed.getByText("Groceries Q3").waitFor({ state: "visible", ...T });

    // Empty wallet: each section shows its own empty state without a rebuild.
    await fresh.locator("footer").getByLabel("Start from an empty wallet (demo)").check();
    await listed.getByText("No datasets yet").waitFor({ state: "visible", ...T });
    await bought.getByText("No purchases yet").waitFor({ state: "visible", ...T });
  }

  // ---- No role UI anywhere ----
  {
    const page = await newPage({ account: accounts.seller });
    await page.goto(baseUrl + "/my-datasets");
    await waitForWallet(page, accounts.seller);
    await page.getByText("Groceries Q3").waitFor({ state: "visible", ...LONG });
    assert((await page.getByRole("radiogroup", { name: "Role" }).count()) === 0, "no Role radiogroup may exist");
  }

  // ---- Footer position: on a short page the footer bottom is the viewport bottom ----
  {
    const page = await newPage({ account: null, viewport: { width: 1280, height: 800 } });
    await page.goto(baseUrl + "/my-datasets");
    await page.getByRole("heading", { name: "Connect your wallet to continue" }).waitFor({ state: "visible", ...LONG });
    const box = await page.locator("footer").boundingBox();
    assert(box !== null, "footer has no bounding box");
    assert(Math.abs(box.y + box.height - 800) <= 1, `footer bottom should be 800 on a short page, got ${box.y + box.height}`);
  }

  // ---- 360px: the menu is the navigation, nothing scrolls sideways ----
  {
    const page = await newPage({ account: accounts.seller, viewport: { width: 360, height: 800 } });
    await page.goto(baseUrl + "/my-datasets");
    await page.getByText("Groceries Q3").waitFor({ state: "visible", ...LONG });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth);
    assert(overflow <= 360, `page must not scroll horizontally at 360px (scrollWidth ${overflow}px)`);
    assert(
      !(await page.locator("header").getByRole("navigation", { name: "Primary" }).isVisible()),
      "the Primary nav must not be visible at 360px",
    );
    await page.locator("header").getByRole("link", { name: "Opaquely" }).waitFor({ state: "visible", ...T });
    const toggle = page.getByRole("button", { name: "Open menu" });
    await toggle.waitFor({ state: "visible", ...T });
    await toggle.click();
    const panel = page.locator("#staggered-menu-panel");
    await panel.getByRole("link", { name: "My Account", exact: true }).waitFor({ state: "visible", ...T });
    await panel.getByText("Simulated data and transactions. Nothing is sent to a chain yet.").waitFor({ state: "visible", ...T });
    await panel.getByRole("link", { name: "My Account", exact: true }).click();
    await page.waitForURL((u) => u.pathname === "/account", { timeout: 15_000 });
  }

  // ---- 768px: the Primary nav is back and nothing scrolls sideways ----
  {
    const page = await newPage({ account: accounts.seller, viewport: { width: 768, height: 900 } });
    await page.goto(baseUrl + "/my-datasets");
    await page.getByText("Groceries Q3").waitFor({ state: "visible", ...LONG });
    await page.locator("header").getByRole("navigation", { name: "Primary" }).waitFor({ state: "visible", ...T });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth);
    assert(overflow <= 768, `page must not scroll horizontally at 768px (scrollWidth ${overflow}px)`);
  }
}
