/**
 * Is the committed deployment actually on the connected chain?
 *
 * A restarted local node has no contracts at the committed addresses, so every chain read would fail page by
 * page. A failed or pending code read is "unknown", never "missing": the banner shows only when every read
 * succeeded and at least one account is empty. viem reports an empty account as `undefined`, wagmi's
 * useBytecode turns that into `null`, and some RPCs say "0x", so all three count as empty.
 * Pure on purpose: no React and no wagmi import.
 */
export type DeploymentStatus = "ok" | "missing" | "unknown";

export interface CodeRead {
  status: "pending" | "error" | "success";
  data?: string | null;
}

export const STALE_DEPLOYMENT_TEXT =
  "The contracts are not on this chain. The node was probably restarted. Run the deploy again and reload.";

export function deploymentStatus(reads: readonly CodeRead[]): DeploymentStatus {
  if (reads.length === 0) return "unknown";
  if (reads.some((r) => r.status !== "success")) return "unknown";
  const empty = reads.some((r) => !r.data || r.data === "0x");
  return empty ? "missing" : "ok";
}
