"use client";

import type { ReactNode } from "react";
import { useBytecode } from "wagmi";
import { AlertIcon } from "@/components/icons";
import { getDeployment } from "@/contracts";
import { useDataScope } from "@/data/provider";
import { deploymentStatus, STALE_DEPLOYMENT_TEXT } from "@/lib/deployment";

/**
 * Stale-deployment guard. It catches a node restarted without a redeploy (the contracts are gone from the
 * committed addresses) and works on Sepolia too. It reads the code at the registry and the marketplace once per
 * page load through wagmi's own transport and shows a non-dismissible alert only when both reads succeeded and
 * one is empty; a pending or failed read shows nothing. In the stub or off a deployed chain it does nothing.
 */
export function DeploymentGuard({ children }: { children: ReactNode }) {
  const { chainId, source } = useDataScope();
  const deployment = source === "chain" && chainId !== undefined ? getDeployment(chainId) : null;
  const enabled = deployment !== null;
  const registry = useBytecode({ address: deployment?.registry.address, chainId, query: { enabled } });
  const market = useBytecode({ address: deployment?.market.address, chainId, query: { enabled } });
  const status = deployment
    ? deploymentStatus([
        { status: registry.status, data: registry.data },
        { status: market.status, data: market.data },
      ])
    : "unknown";
  const missing = status === "missing";

  return (
    <>
      {missing ? (
        <div role="alert" className="border border-danger bg-[rgba(248,113,113,0.12)] px-4 py-4 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-wrap items-start gap-4">
            <AlertIcon className="mt-0.5 h-6 w-6 shrink-0 text-danger" />
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold">Contracts not found</h2>
              <p className="mt-1 text-muted">{STALE_DEPLOYMENT_TEXT}</p>
            </div>
          </div>
        </div>
      ) : null}
      <div
        data-testid="deployment-guarded"
        inert={missing}
        aria-hidden={missing || undefined}
        className={missing ? "pointer-events-none opacity-40" : undefined}
      >
        {children}
      </div>
    </>
  );
}
