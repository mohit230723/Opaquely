// Phase 2 spike: the browser encrypts a value, the injected wallet signs a real tx against
// `hardhat node` (31337), and Node decrypts the stored total to check it.
// Fails when no node answers on 127.0.0.1:8545, unless E2E_ALLOW_SKIP_FHE=1 (then it prints SKIP and
// passes). run-all.mjs leaves this script out of an unfiltered run when no node is up.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, http, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat as viemHardhat } from "viem/chains";
import { createConfig } from "@zama-fhe/sdk/viem";
import { ZamaSDK, cleartext, memoryStorage } from "@zama-fhe/sdk";
import { hardhat } from "@zama-fhe/sdk/chains";

const RPC = "http://127.0.0.1:8545";
const DEV_KEY_0 = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const artifactPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../contracts/artifacts/contracts/FheSpike.sol/FheSpike.json",
);

export default async function fheSpike({ baseUrl, accounts, assert, waitForWallet, newPage }) {
  const up = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
  }).then((r) => r.ok, () => false);
  if (!up) {
    if (process.env.E2E_ALLOW_SKIP_FHE === "1") {
      console.log("  SKIP fhe-spike: no hardhat node on " + RPC);
      return;
    }
    throw new Error("no hardhat node on " + RPC + " (run: node contracts/scripts/dev-node.mjs start)");
  }
  if (!fs.existsSync(artifactPath)) {
    throw new Error("FheSpike artifact missing: run npm --prefix contracts run compile");
  }
  const art = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const account = privateKeyToAccount(DEV_KEY_0);
  const publicClient = createPublicClient({ chain: viemHardhat, transport: http(RPC) });
  const walletClient = createWalletClient({ account, chain: viemHardhat, transport: http(RPC) });
  const deployHash = await walletClient.deployContract({ abi: art.abi, bytecode: art.bytecode });
  const contractAddress = getAddress((await publicClient.waitForTransactionReceipt({ hash: deployHash })).contractAddress);

  const page = await newPage({ account: accounts.seller, rpcUrl: RPC });
  await page.goto(`${baseUrl}/dev/fhe?address=${contractAddress}`);
  await waitForWallet(page, accounts.seller);

  // Bad amounts are refused before the SDK runs.
  for (const bad of ["abc", "18446744073709551616"]) {
    await page.getByLabel("Amount").fill(bad);
    await page.getByRole("button", { name: "Encrypt and submit" }).click();
    await page.getByTestId("status").filter({ hasText: "failed: Enter a whole number" }).waitFor({ timeout: 5_000 });
    const text = (await page.getByTestId("status").textContent()) ?? "";
    assert(text.startsWith("failed: Enter a whole number"), `expected a whole-number refusal for ${bad}, got ${text}`);
    // Reload so the next case starts from "idle" and cannot pass on this case's leftover status text.
    await page.reload();
    await waitForWallet(page, accounts.seller);
    const fresh = (await page.getByTestId("status").textContent()) ?? "";
    assert(fresh === "idle", `expected status to reset to idle after reload, got ${fresh}`);
  }

  await page.getByLabel("Amount").fill("4242");
  await page.getByRole("button", { name: "Encrypt and submit" }).click();
  await page.getByTestId("status").filter({ hasText: "confirmed" }).waitFor({ timeout: 60_000 });
  const handle = (await page.getByTestId("handle").textContent()) ?? "";
  const txHash = (await page.getByTestId("txhash").textContent()) ?? "";
  assert(/^0x[0-9a-f]{64}$/i.test(handle), "expected a 32-byte input handle, got " + handle);
  assert(/^0x[0-9a-f]{64}$/i.test(txHash), "expected a tx hash, got " + txHash);

  // Decrypt check (Node, cleartext relayer + chain override), as in .planning/reference/spike/e2e2.mjs.
  const chain = {
    ...hardhat,
    gatewayChainId: 100733346448153,
    verifyingContractAddressDecryption: "0xEaaA2FC6BC259dF015Aa7Dc8e59e0B67df622721",
    verifyingContractAddressInputVerification: "0x6189F6c0c3E40B4a3c72ec86262295D78d845297",
    inputSignerPrivateKey: "0xcae2ef860129ace577171fcfd131fe77bf849460f05b0b128ecfb75b53541ecc",
    kmsSignerPrivateKey: "0x0000000000000000000000000000000000000000000000000000000000000001",
  };
  const sdk = new ZamaSDK(
    createConfig({ chains: [chain], publicClient, walletClient, storage: memoryStorage, relayers: { [hardhat.id]: cleartext() } }),
  );
  const totalHandle = await publicClient.readContract({ address: contractAddress, abi: art.abi, functionName: "total", account: account.address });
  const dec = await sdk.decryption.decryptValues([{ encryptedValue: totalHandle, contractAddress }]);
  sdk.terminate();
  assert(dec[totalHandle] === 4242n, "expected decrypted total 4242, got " + String(dec[totalHandle]));
  console.log(
    "  FHE SPIKE OK contract=" + contractAddress + " handle=" + handle.slice(0, 18) + " tx=" + txHash.slice(0, 18) + " decrypted=4242",
  );
}
