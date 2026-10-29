export type GateInput = {
  /** True once wagmi's first reconnect attempt has settled (see wallet-ready.ts). */
  walletReady: boolean;
  status: "connecting" | "reconnecting" | "connected" | "disconnected";
};

export type GateResult = "loading" | "connect" | "allow";

/**
 * Pure decision behind WalletGate. Nothing is decided until the wallet has settled, so a reload
 * never flashes the connect prompt on a stale "disconnected" snapshot. There is no role: every
 * wallet page opens for any connected wallet, and real authorization stays on-chain.
 */
export function gateDecision({ walletReady, status }: GateInput): GateResult {
  if (!walletReady) return "loading";
  if (status === "connecting" || status === "reconnecting") return "loading";
  return status === "disconnected" ? "connect" : "allow";
}
