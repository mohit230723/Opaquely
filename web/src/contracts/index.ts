import type { Abi, Address } from "viem";
import { getAddress } from "viem";
import { deployments } from "./deployments";

// The one place that reads the GENERATED deployments file. Addresses and ABIs never come from anywhere else.
export interface ContractRef {
  address: Address;
  abi: Abi;
}

export interface Deployment {
  chainId: number;
  registry: ContractRef;
  market: ContractRef;
  /** First block to scan for events. */
  deployBlock: bigint;
}

interface RawDeployment {
  chainId: number;
  deployBlock: number | string;
  DatasetRegistry: { address: string; abi: unknown };
  Marketplace: { address: string; abi: unknown };
}

/** The deployment for a chain, or null when the deploy script never ran against it. */
export function getDeployment(chainId: number): Deployment | null {
  const raw = (deployments as unknown as Record<string, RawDeployment | undefined>)[String(chainId)];
  if (!raw?.DatasetRegistry?.address || !raw?.Marketplace?.address) return null;
  return {
    chainId,
    registry: { address: getAddress(raw.DatasetRegistry.address), abi: raw.DatasetRegistry.abi as Abi },
    market: { address: getAddress(raw.Marketplace.address), abi: raw.Marketplace.abi as Abi },
    deployBlock: BigInt(raw.deployBlock),
  };
}
