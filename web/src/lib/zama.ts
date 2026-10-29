"use client";

// The only file (with fhe.ts) allowed to import @zama-fhe/sdk. Client-only: the SDK is
// loaded with a dynamic import inside async functions, so the server never evaluates it.
import type { PublicClient, WalletClient } from "viem";
import type { ZamaSDK } from "@zama-fhe/sdk";
import { SEPOLIA_CHAIN_ID } from "./constants";
import { supportedChainIds } from "./network";
import { LOCAL_CHAIN_ONLY_MESSAGE, WALLET_REQUIRED_MESSAGE } from "./tx-errors";

// Public dev constants from @fhevm/host-contracts-cleartext (ts/cleartext-config.ts and
// ts/signers/defaultCoprocessorSigners.ts). Local mock only, never real keys.
const CLEARTEXT_OVERRIDE = {
  gatewayChainId: 100733346448153,
  verifyingContractAddressDecryption: "0xEaaA2FC6BC259dF015Aa7Dc8e59e0B67df622721",
  verifyingContractAddressInputVerification: "0x6189F6c0c3E40B4a3c72ec86262295D78d845297",
  inputSignerPrivateKey: "0xcae2ef860129ace577171fcfd131fe77bf849460f05b0b128ecfb75b53541ecc",
  kmsSignerPrivateKey: "0x0000000000000000000000000000000000000000000000000000000000000001",
} as const;

export type ZamaClients = { publicClient: PublicClient; walletClient: WalletClient };

// One SDK per (chainId, account). Switching wallet account builds a fresh one. The key is only
// (chainId, account), so a replaced walletClient for the same account is not picked up; that is
// harmless for cleartext encrypt, which never signs through the wallet client.
let cached: { key: string; sdk: Promise<ZamaSDK> } | null = null;

export async function getZamaSdk(chainId: number, clients: ZamaClients): Promise<ZamaSDK> {
  if (!supportedChainIds().includes(chainId)) {
    throw new Error(LOCAL_CHAIN_ONLY_MESSAGE);
  }
  const account = clients.walletClient.account?.address;
  if (!account) throw new Error(WALLET_REQUIRED_MESSAGE);
  const key = `${chainId}:${account.toLowerCase()}`;
  if (cached?.key === key) return cached.sdk;

  const previous = cached?.sdk;
  const sdk = (async () => {
    if (previous) (await previous.catch(() => null))?.terminate();
    if (chainId === SEPOLIA_CHAIN_ID) {
      // Real FHE. The sepolia preset carries every contract address and the relayer URL (no API key).
      // The local override above must never be spread here: it holds dev signer keys, and the SDK
      // blocks cleartext() on Sepolia anyway. The worker and WASM live inside the SDK. If the worker
      // fails at runtime, the README fallback is web({ offloadEncrypt: false }).
      const [{ ZamaSDK, memoryStorage }, { web }, { createConfig }, { sepolia }] = await Promise.all([
        import("@zama-fhe/sdk"),
        import("@zama-fhe/sdk/web"),
        import("@zama-fhe/sdk/viem"),
        import("@zama-fhe/sdk/chains"),
      ]);
      return new ZamaSDK(
        createConfig({
          chains: [sepolia],
          publicClient: clients.publicClient,
          walletClient: clients.walletClient,
          storage: memoryStorage,
          relayers: { [sepolia.id]: web() },
        }),
      );
    }
    const [{ ZamaSDK, cleartext, memoryStorage }, { createConfig }, { hardhat }] = await Promise.all([
      import("@zama-fhe/sdk"),
      import("@zama-fhe/sdk/viem"),
      import("@zama-fhe/sdk/chains"),
    ]);
    const chain = { ...hardhat, ...CLEARTEXT_OVERRIDE };
    return new ZamaSDK(
      createConfig({
        chains: [chain],
        publicClient: clients.publicClient,
        walletClient: clients.walletClient,
        storage: memoryStorage,
        relayers: { [hardhat.id]: cleartext() },
      }),
    );
  })();
  cached = { key, sdk };
  sdk.catch(() => {
    if (cached?.sdk === sdk) cached = null; // do not cache a failed init
  });
  return sdk;
}
