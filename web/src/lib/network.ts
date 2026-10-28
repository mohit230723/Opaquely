import { HARDHAT_CHAIN_ID, SEPOLIA_CHAIN_ID } from "./constants";

// Phase 6 adds Sepolia here. Until then the app only runs against the local Hardhat chain.
export const SUPPORTED_CHAIN_IDS: readonly number[] = [HARDHAT_CHAIN_ID];

export const NETWORK_TOOLTIP = "Transactions run on a local test chain. Encryption here is simulated, not real FHE.";

/** True only when a wallet is connected on a chain the app does not support. */
export function isWrongNetwork({ isConnected, chainId }: { isConnected: boolean; chainId: number | undefined }): boolean {
  if (!isConnected || chainId === undefined) return false;
  return !SUPPORTED_CHAIN_IDS.includes(chainId);
}

/** Mode label for the header badge. The local mode is never described as real FHE. */
export function networkLabel(chainId: number | undefined): string {
  if (chainId === undefined || chainId === HARDHAT_CHAIN_ID) return "Local FHEVM mock";
  if (chainId === SEPOLIA_CHAIN_ID) return "Sepolia, real FHE";
  return "Wrong network";
}

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  [SEPOLIA_CHAIN_ID]: "Sepolia",
  [HARDHAT_CHAIN_ID]: "Hardhat",
};

export function chainDisplayName(chainId: number): string {
  return CHAIN_NAMES[chainId] ?? `chain ${chainId}`;
}
