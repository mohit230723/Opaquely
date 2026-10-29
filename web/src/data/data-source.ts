import { getDeployment } from "@/contracts";
import { HARDHAT_CHAIN_ID } from "@/lib/constants";
import type { DataScope } from "./types";

declare global {
  interface Window {
    /** Test and demo override, set before the app loads (e2e init script). Never persisted. */
    __OPAQUELY_DATA?: "stub" | "chain";
  }
}

/**
 * Which DataLayer to build. Three inputs decide it, in this order:
 * 1. A force-to-stub flag: window.__OPAQUELY_DATA = "stub" (the Phase 1 e2e scripts set it before the
 *    app loads) or, when the window flag is unset, a build with NEXT_PUBLIC_OPAQUELY_DATA=stub (a demo
 *    with no node). The window flag wins when set. A window value of "chain" only overrides the env
 *    flag; it never forces live past the automatic rule below.
 * 2. The chain id: anything other than the local chain (31337) gets the stub.
 * 3. The deployment: the real contracts only when the deploy script has written an entry for the chain.
 */
export function resolveDataSource(chainId: number | undefined): DataScope["source"] {
  // Read inside the function (not at module level) so tests can stub it. Next inlines it at build time.
  const windowFlag = typeof window === "undefined" ? undefined : window.__OPAQUELY_DATA;
  const forced = windowFlag ?? (process.env.NEXT_PUBLIC_OPAQUELY_DATA === "stub" ? "stub" : undefined);
  if (forced === "stub") return "stub";
  if (chainId === undefined || chainId !== HARDHAT_CHAIN_ID) return "stub";
  return getDeployment(chainId) !== null ? "chain" : "stub";
}
