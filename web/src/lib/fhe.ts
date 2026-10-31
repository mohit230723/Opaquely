"use client";

import { getAddress, type Address, type Hex } from "viem";
import { WALLET_REQUIRED_MESSAGE } from "./tx-errors";
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
  if (!userAddress) throw new Error(WALLET_REQUIRED_MESSAGE);
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
  if (!userAddress) throw new Error(WALLET_REQUIRED_MESSAGE);
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

/**
 * User decryption: the connected wallet signs one EIP-712 permit (cached by the SDK for the session) and the
 * relayer returns the clear values of `handles`, which must all belong to `contractAddress` and be allowed for
 * this wallet on-chain (FHE.allow). Zero handles come back as 0n without a relayer call.
 */
export async function decryptHandles(
  chainId: number,
  clients: ZamaClients,
  contractAddress: Address,
  handles: readonly Hex[],
): Promise<bigint[]> {
  const sdk = await getFhevm(chainId, clients);
  const contract = getAddress(contractAddress);
  const clear = await sdk.decryption.decryptValues(handles.map((h) => ({ encryptedValue: h, contractAddress: contract })));
  return handles.map((h) => {
    const v = clear[h];
    if (typeof v === "bigint") return v;
    if (typeof v === "boolean") return v ? 1n : 0n;
    if (v === undefined) throw new Error("The relayer returned no value for a handle.");
    return BigInt(v);
  });
}

export type EncryptedInsights = { u64s: Hex[]; u32s: Hex[]; inputProof: Hex };

/**
 * Encrypts the ML insights as ONE batch for DatasetRegistry.setInsights: seven uint64 values (six monthly
 * totals, then the forecast) and six uint32 values (the ML anomaly count, then five score buckets).
 */
export async function encryptInsights(
  chainId: number,
  clients: ZamaClients,
  contractAddress: Address,
  values: { u64s: readonly bigint[]; u32s: readonly bigint[] },
): Promise<EncryptedInsights> {
  const sdk = await getFhevm(chainId, clients);
  const userAddress = clients.walletClient.account?.address;
  if (!userAddress) throw new Error(WALLET_REQUIRED_MESSAGE);
  const enc = await sdk.encrypt({
    values: [
      ...values.u64s.map((value) => ({ value, type: "euint64" as const })),
      ...values.u32s.map((value) => ({ value, type: "euint32" as const })),
    ],
    contractAddress: getAddress(contractAddress),
    userAddress: getAddress(userAddress),
  });
  const n = values.u64s.length;
  return { u64s: enc.encryptedValues.slice(0, n), u32s: enc.encryptedValues.slice(n), inputProof: enc.inputProof };
}
