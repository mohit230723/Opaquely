"use client";

import { getAddress, type Address, type Hex } from "viem";
import { getZamaSdk, type ZamaClients } from "./zama";

export type EncryptedAmount = { handle: Hex; inputProof: Hex };

/** One entry point for chain selection; Phase 6 adds Sepolia here. */
export async function getFhevm(chainId: number, clients: ZamaClients) {
  return getZamaSdk(chainId, clients);
}

/** Encrypts a uint64 for `contractAddress` on behalf of the connected wallet. */
export async function encryptUint64(
  chainId: number,
  clients: ZamaClients,
  contractAddress: Address,
  value: bigint,
): Promise<EncryptedAmount> {
  const sdk = await getFhevm(chainId, clients);
  const userAddress = clients.walletClient.account?.address;
  if (!userAddress) throw new Error("Connect a wallet first");
  // The relayer rejects non-checksummed addresses.
  const enc = await sdk.encrypt({
    values: [{ value, type: "euint64" }],
    contractAddress: getAddress(contractAddress),
    userAddress: getAddress(userAddress),
  });
  return { handle: enc.encryptedValues[0], inputProof: enc.inputProof };
}
