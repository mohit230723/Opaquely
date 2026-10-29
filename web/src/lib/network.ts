import { getDeployment } from "@/contracts";
import { HARDHAT_CHAIN_ID, SEPOLIA_CHAIN_ID } from "./constants";

/** The chains every build supports (the local base). Consumers call supportedChainIds(), which adds Sepolia when it is switched on. */
export const SUPPORTED_CHAIN_IDS: readonly number[] = [HARDHAT_CHAIN_ID];

export const NETWORK_TOOLTIP = "Transactions run on a local test chain. Encryption here is simulated, not real FHE.";

export const SEPOLIA_TOOLTIP =
  "Transactions run on Sepolia, a public test network. Amounts, dates and categories are encrypted with Zama's FHE in this browser.";

/**
 * Build-time Sepolia switch: only the exact string "1" turns it on. Read inside the function (not at module
 * level) so tests can stub it. Next inlines the literal at build time.
 */
export function sepoliaFlagOn(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_SEPOLIA === "1";
}

/** Sepolia is usable only when the flag is on AND the deploy script has written a Sepolia entry. */
export function sepoliaEnabled(): boolean {
  return sepoliaFlagOn() && getDeployment(SEPOLIA_CHAIN_ID) !== null;
}

/** The chain ids this build supports. The one source that the gate, the data source and the FHE seam all call. */
export function supportedChainIds(): readonly number[] {
  return sepoliaEnabled() ? [HARDHAT_CHAIN_ID, SEPOLIA_CHAIN_ID] : SUPPORTED_CHAIN_IDS;
}

/** True only when a wallet is connected on a chain the app does not support. */
export function isWrongNetwork({ isConnected, chainId }: { isConnected: boolean; chainId: number | undefined }): boolean {
  if (!isConnected || chainId === undefined) return false;
  return !supportedChainIds().includes(chainId);
}

/** Header badge tooltip. Sepolia gets its own sentence only when Sepolia is really enabled. */
export function networkTooltip(chainId: number | undefined): string {
  return chainId === SEPOLIA_CHAIN_ID && sepoliaEnabled() ? SEPOLIA_TOOLTIP : NETWORK_TOOLTIP;
}

const NOT_DEPLOYED_HINT =
  "Sepolia is turned on in this build, but no contracts are deployed there yet. Follow the Sepolia runbook in README.md.";

/** Copy for the wrong-network gate. Flag off, the strings are exactly the local-only ones. */
export function wrongNetworkMessage(chainId: number): { text: string; hint?: string; switchFailed: string } {
  const name = chainDisplayName(chainId);
  if (sepoliaEnabled()) {
    return {
      text: `Opaquely runs on the Hardhat local chain (chain ${HARDHAT_CHAIN_ID}) or on Sepolia (chain ${SEPOLIA_CHAIN_ID}). Your wallet is on ${name}.`,
      switchFailed: `Could not switch network. Open your wallet and select Hardhat (chain ${HARDHAT_CHAIN_ID}) or Sepolia (chain ${SEPOLIA_CHAIN_ID}).`,
    };
  }
  return {
    text: `Opaquely runs on the Hardhat local chain (chain ${HARDHAT_CHAIN_ID}). Your wallet is on ${name}.`,
    ...(chainId === SEPOLIA_CHAIN_ID && sepoliaFlagOn() ? { hint: NOT_DEPLOYED_HINT } : {}),
    switchFailed: `Could not switch network. Open your wallet and select Hardhat (chain ${HARDHAT_CHAIN_ID}).`,
  };
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

const LOCAL_MOCK_NOTE = "Local FHEVM mock: a local test chain. Encryption is simulated, not real FHE. Never enter a real bill.";
const SEPOLIA_NOTE =
  "Sepolia, real FHE: a public test network. Amounts, dates and categories are encrypted with Zama's FHE in this browser. Test ETH only.";

/**
 * The honest footer line for chain mode (the stub keeps its own sentence). The local chain is a mock and
 * the line says so; chain mode never runs on an unsupported chain, so that case is empty.
 */
export function chainModeNote(chainId: number | undefined): string {
  if (chainId === undefined || chainId === HARDHAT_CHAIN_ID) return LOCAL_MOCK_NOTE;
  if (chainId === SEPOLIA_CHAIN_ID) return SEPOLIA_NOTE;
  return "";
}
