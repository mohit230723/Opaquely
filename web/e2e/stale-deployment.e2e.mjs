// Opt-in proof of the stale-deployment banner (DeploymentGuard). It runs only when named:
// `node scripts/demo-rehearse.mjs --stale` names it on a node that was restarted WITHOUT a deploy.
// It fails by design on a deployed node. Both chain-mode pages must show the non-dismissible alert and the
// page below it must be inert.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RPC = "http://127.0.0.1:8545";
const T = { timeout: 30_000 };
const STALE_TEXT = "The contracts are not on this chain. The node was probably restarted. Run the deploy again and reload.";
const here = path.dirname(fileURLToPath(import.meta.url));
const deployments = JSON.parse(fs.readFileSync(path.resolve(here, "../src/contracts/deployments.json"), "utf8"))["31337"];

async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(5_000),
  });
  return (await res.json()).result;
}

export default async function staleDeployment({ baseUrl, accounts, assert, waitForWallet, newPage }) {
  const chainId = await rpc("eth_chainId", []).catch(() => null);
  if (!chainId) throw new Error("no hardhat node on " + RPC);
  const registry = deployments.DatasetRegistry.address;
  const code = await rpc("eth_getCode", [registry, "latest"]);
  if (code !== "0x") {
    throw new Error(
      "contracts are deployed on this node; run stale-deployment only on a node restarted without a deploy (node scripts/demo-rehearse.mjs --stale)",
    );
  }

  for (const [route, who, role] of [
    ["/buy", accounts.buyer, "buyer"],
    ["/sell", accounts.seller, "seller"],
  ]) {
    const page = await newPage({ account: who, roles: { [who]: role }, rpcUrl: RPC, data: "chain" });
    await page.goto(baseUrl + route);
    await waitForWallet(page, who);
    await page.getByRole("alert").filter({ hasText: STALE_TEXT }).waitFor(T);
    const guarded = page.locator('[data-testid="deployment-guarded"]');
    assert((await guarded.getAttribute("inert")) !== null, `${route}: the page below the banner must be inert`);
  }

  console.log(`  STALE GUARD OK registry=${registry} code=${code}`);
}
