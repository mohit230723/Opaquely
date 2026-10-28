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
}
