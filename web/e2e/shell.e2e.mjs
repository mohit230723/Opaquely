// App shell: network badge, wrong-network gate and switch, role-aware nav, role switcher, stub footer.

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
    const page = await newPage({ account: accounts.seller, chainId: 1, roles: { [accounts.seller]: "seller" } });
    await page.goto(baseUrl + "/sell");
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

  // ---- Seller nav, footer, demo toggles ----
  {
    const page = await newPage({ account: accounts.seller, roles: { [accounts.seller]: "seller" } });
    await page.goto(baseUrl + "/sell");
    await waitForWallet(page, accounts.seller);
    await page.getByText("Groceries Q3").waitFor({ state: "visible", ...LONG });

    // The skip link is the first focusable element.
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement && document.activeElement.textContent);
    assert((focused ?? "").trim() === "Skip to content", `first Tab stop must be the skip link, got: ${focused}`);

    const nav = page.getByRole("navigation", { name: "Seller" });
    for (const name of ["Dashboard", "Datasets", "Activity"]) {
      await nav.getByRole("link", { name }).waitFor({ state: "visible", ...T });
    }
    assert(
      (await nav.getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")) === "page",
      "Dashboard must be marked aria-current=page on /sell",
    );
    assert(
      (await nav.getByRole("link", { name: "Datasets" }).getAttribute("aria-current")) === null,
      "Datasets must not be active on /sell",
    );
    await page.getByText("Simulated data and transactions. Nothing is sent to a chain yet.").waitFor({ state: "visible", ...T });

    // Fail the next transaction: one failure, then Try again confirms.
    await page.getByLabel("Fail the next transaction (demo)").check();
    await page.getByRole("link", { name: "Create dataset" }).first().click();
    await page.waitForURL((u) => u.pathname === "/sell/datasets/new", { timeout: 15_000 });
    await page.getByLabel("Dataset name").fill("Fails once");
    await page.getByRole("button", { name: "Create dataset" }).click();
    await page.getByText("Transaction failed").waitFor({ state: "visible", ...T });
    await page.getByText("Simulated failure: execution reverted.").waitFor({ state: "visible", ...T });
    await page.getByRole("button", { name: "Try again" }).click();
    await page.getByText("Transaction confirmed").waitFor({ state: "visible", ...T });

    // Fail the next read: the loaded page stays and a "Couldn't refresh" note appears (a failed refetch must
    // never replace data that is already on screen); Try again clears the note.
    await page.goBack();
    await page.waitForURL((u) => u.pathname === "/sell", { timeout: 15_000 });
    await page.getByText("Fails once").waitFor({ state: "visible", ...LONG });
    await page.getByLabel("Fail the next read (demo)").check();
    await page.getByText(/Couldn't refresh/).first().waitFor({ state: "visible", ...T });
    await page.getByText("Groceries Q3").waitFor({ state: "visible", ...T });
    assert((await page.getByText(/Could not load/).count()) === 0, "a failed refetch must not replace the loaded page with the error card");
    await page.getByRole("button", { name: "Try again" }).click();
    await page.getByText(/Couldn't refresh/).waitFor({ state: "detached", ...T });
    await page.getByText("Groceries Q3").waitFor({ state: "visible", ...T });

    // Empty wallet: the empty state shows without a rebuild.
    await page.getByLabel("Start from an empty wallet (demo)").check();
    await page.getByText("No datasets yet").waitFor({ state: "visible", ...T });
  }

  // ---- Role switcher ----
  {
    const page = await newPage({ account: accounts.seller, roles: { [accounts.seller]: "seller" } });
    await page.goto(baseUrl + "/sell");
    await waitForWallet(page, accounts.seller);
    await page.getByText("Groceries Q3").waitFor({ state: "visible", ...LONG });
    const group = page.getByRole("radiogroup", { name: "Role" });
    assert(
      (await group.getByRole("radio", { name: "Seller" }).getAttribute("aria-checked")) === "true",
      "Seller must be the selected role",
    );
    // /buy does not exist yet, so the navigation reloads the page and the harness re-seeds localStorage.
    // Record role writes in sessionStorage (it survives the reload) to prove what the switcher stored.
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (String(key).startsWith("opaquely:role:")) sessionStorage.setItem("__write:" + key, value);
        return original.call(this, key, value);
      };
    });
    await group.getByRole("radio", { name: "Buyer" }).click();
    await page.waitForURL((u) => u.pathname === "/buy", { timeout: 15_000 });
    // The /buy page itself arrives in plan 01-10; only the URL and the stored role are asserted.
    const stored = await page.evaluate(() => sessionStorage.getItem("__write:opaquely:role:0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"));
    assert(stored === "buyer", `role must be stored as buyer, got: ${stored}`);
  }

  // ---- 360px: the nav sits on a second row and the page does not scroll sideways ----
  {
    const page = await newPage({
      account: accounts.seller,
      roles: { [accounts.seller]: "seller" },
      viewport: { width: 360, height: 740 },
    });
    await page.goto(baseUrl + "/sell");
    // Below 640px the connect button shows only an avatar, so the nav (connected only) is the signal.
    const nav = page.getByRole("navigation", { name: "Seller" });
    await nav.waitFor({ state: "visible", ...LONG });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow <= 0, `page must not scroll horizontally at 360px (overflow ${overflow}px)`);
    const wordmark = await page.getByRole("link", { name: "Opaquely" }).boundingBox();
    const navBox = await nav.boundingBox();
    assert(navBox && wordmark && navBox.y >= wordmark.y + wordmark.height - 1, "nav must sit on a row under the wordmark at 360px");
  }
}
