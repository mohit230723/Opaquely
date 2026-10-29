"use client";

import type { ReactNode } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { PageShell } from "@/components/PageShell";
import { gateDecision } from "@/lib/wallet-gate";
import { useWalletReady } from "@/lib/wallet-ready";

/** Page-shaped loading block shown while the wallet is still being resolved. */
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
 * Wallet pages open for any connected wallet. Mount it once, in the (app) route-group layout.
 * A disconnected visitor sees a connect prompt in place (no redirect). The gate is UI only:
 * every write is authorized on-chain.
 */
export function WalletGate({ children }: { children: ReactNode }) {
  const { status } = useAccount();
  const walletReady = useWalletReady();
  const decision = gateDecision({ walletReady, status });

  if (decision === "allow") return <>{children}</>;
  if (decision === "connect") {
    return (
      <PageShell title="Connect your wallet to continue" subtitle="Connect a wallet to upload, buy and manage datasets.">
        <ConnectButton showBalance={false} />
      </PageShell>
    );
  }
  return <GuardLoading />;
}
