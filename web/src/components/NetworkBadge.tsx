"use client";

import { useAccount } from "wagmi";
import { StatusChip } from "@/components/ui/StatusChip";
import { NETWORK_TOOLTIP, isWrongNetwork, networkLabel } from "@/lib/network";

/** Mode label shown on every page. Uses the wallet's chain, not wagmi's configured chain. */
export function NetworkBadge() {
  const { chainId, isConnected } = useAccount();
  const wrong = isWrongNetwork({ isConnected, chainId });
  const label = wrong ? "Wrong network" : networkLabel(chainId);

  return (
    <span title={NETWORK_TOOLTIP} data-testid="network-badge">
      <StatusChip variant={wrong ? "danger" : "info"}>{label}</StatusChip>
    </span>
  );
}
