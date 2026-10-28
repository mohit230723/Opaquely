import type { Role } from "./role";

export type GuardNeed = Role | "any";

export type GuardInput = {
  /** True once wagmi's first reconnect attempt has settled (see wallet-ready.ts). */
  walletReady: boolean;
  status: "connecting" | "reconnecting" | "connected" | "disconnected";
  /** undefined = not known yet (server render or before hydration), null = none chosen. */
  role: Role | null | undefined;
  need: GuardNeed;
};

export type GuardResult = "loading" | "allow" | "to-home" | "to-role";

/**
 * Pure decision behind RoleGuard. Order matters: nothing is decided (and nothing redirects)
 * until the wallet has settled, so a reloading seller is never bounced to "/" on a stale
 * "disconnected" snapshot.
 */
export function guardDecision({ walletReady, status, role, need }: GuardInput): GuardResult {
  if (!walletReady) return "loading";
  if (status === "connecting" || status === "reconnecting") return "loading";
  if (status === "disconnected") return "to-home";
  if (role === undefined) return "loading";
  if (role === null) return "to-role";
  if (need === "any") return "allow";
  return role === need ? "allow" : "to-role";
}
