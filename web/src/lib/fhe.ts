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

export type EncryptedBill = { amount: Hex; category: Hex; date: Hex; inputProof: Hex };

/**
 * Encrypts one bill as ONE batch: amount (euint64 cents), category (euint8) and date (euint32 days),
 * all covered by a single input proof bound to (contractAddress, wallet). No merchant name is a
 * parameter, so it cannot be encrypted or sent by mistake.
 */
export async function encryptBill(
  chainId: number,
  clients: ZamaClients,
  contractAddress: Address,
  bill: { amountCents: bigint; category: number; dateDays: number },
): Promise<EncryptedBill> {
  const sdk = await getFhevm(chainId, clients);
  const userAddress = clients.walletClient.account?.address;
  if (!userAddress) throw new Error("Connect a wallet first");
  const enc = await sdk.encrypt({
    values: [
      { value: bill.amountCents, type: "euint64" },
      { value: BigInt(bill.category), type: "euint8" },
      { value: BigInt(bill.dateDays), type: "euint32" },
    ],
    contractAddress: getAddress(contractAddress),
    userAddress: getAddress(userAddress),
  });
  const [amount, category, date] = enc.encryptedValues;
  return { amount, category, date, inputProof: enc.inputProof };
}
