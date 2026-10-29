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
    await page.getByText("Simulated data and transactions. Nothing is sent to a chain yet.").waitFor({ state: "visible", ...T });

    // Fail the next transaction: one failure, then Try again confirms.
    await page.getByLabel("Fail the next transaction (demo)").check();
    await page.getByRole("button", { name: "Withdraw balance" }).click();
    await page.getByText("Transaction failed").waitFor({ state: "visible", ...T });
    await page.getByText("Simulated failure: execution reverted.").waitFor({ state: "visible", ...T });
    await page.getByRole("button", { name: "Try again" }).waitFor({ state: "visible", ...T });

    // Fail the next read on /my-datasets: the failed read shows its error state with Try again ("Couldn't
    // refresh" when data is already on screen, which must never be replaced by the error card).
    await nav.getByRole("link", { name: "My Datasets" }).click();
    await page.waitForURL((u) => u.pathname === "/my-datasets", { timeout: 15_000 });
    await page.getByText("Groceries Q3").waitFor({ state: "visible", ...LONG });
    await page.getByLabel("Fail the next read (demo)").check();
    await page.getByText(/Could not load|Couldn't refresh/).first().waitFor({ state: "visible", ...T });
    await page.getByRole("button", { name: "Try again" }).first().click();
    await page.getByText(/Could not load|Couldn't refresh/).first().waitFor({ state: "detached", ...T });
    await page.getByText("Groceries Q3").waitFor({ state: "visible", ...T });

    // Empty wallet: the empty state shows without a rebuild.
    await page.getByLabel("Start from an empty wallet (demo)").check();
    await page.getByText("No datasets yet").waitFor({ state: "visible", ...T });
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

  // ---- 360px: nothing scrolls sideways and the header logo link is visible ----
  {
    const page = await newPage({ account: accounts.seller, viewport: { width: 360, height: 740 } });
    await page.goto(baseUrl + "/my-datasets");
    await page.getByText("Groceries Q3").waitFor({ state: "visible", ...LONG });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth);
    assert(overflow <= 360, `page must not scroll horizontally at 360px (scrollWidth ${overflow}px)`);
    await page.locator("header").getByRole("link", { name: "Opaquely" }).waitFor({ state: "visible", ...T });
  }
}
