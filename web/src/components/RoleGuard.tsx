"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { guardDecision, type GuardNeed } from "@/lib/guard";
import { isRoleSwitching, useRole } from "@/lib/role";
import { useWalletReady } from "@/lib/wallet-ready";

/** Page-shaped loading block shown while the wallet or the role is still being resolved. */
export function GuardLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6" aria-busy="true">
      <span className="sr-only">Loading</span>
      <div aria-hidden="true" className="skeleton-pulse h-8 w-64 rounded-lg bg-surface-raised" />
      <div aria-hidden="true" className="mt-8 flex flex-col gap-4">
        <div className="skeleton-pulse h-24 w-full rounded-lg bg-surface-raised" />
        <div className="skeleton-pulse h-24 w-full rounded-lg bg-surface-raised" />
      </div>
    </div>
  );
}

/**
 * Keeps other roles and disconnected visitors out of an area. Mount it once per area, in the
 * route-group layout, never in individual pages. The role is a UI preference, not a security
 * boundary: real authorization is on-chain.
 */
export function RoleGuard({ need, children }: { need: GuardNeed; children: ReactNode }) {
  const router = useRouter();
  const { status, address } = useAccount();
  const role = useRole(address);
  const walletReady = useWalletReady();
  const decision = guardDecision({ walletReady, status, role, need });

  useEffect(() => {
    if (isRoleSwitching()) return; // the header RoleSwitcher is navigating to the other area
    if (decision === "to-home") router.replace("/");
    else if (decision === "to-role") router.replace("/role");
  }, [decision, router]);

  if (decision === "allow") return <>{children}</>;
  return <GuardLoading />;
}
