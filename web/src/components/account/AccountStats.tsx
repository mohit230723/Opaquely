"use client";

import type { ReactNode } from "react";
import { Skeleton } from "@/components/Skeleton";
import { TxStatus } from "@/components/TxStatus";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useWithdraw } from "@/data/hooks";
import type { SellerStats as SellerStatsData } from "@/data/types";
import { formatEth, plural } from "@/lib/format";
import { isBusy } from "@/lib/tx-machine";

// Earnings row: 3 columns from 768px. Activity row: 2 columns from 640px, 5 from 1280px.
const EARNINGS_GRID = "grid grid-cols-1 gap-4 md:grid-cols-3";
const ACTIVITY_GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5";

/**
 * One stat as a GlowCard. The card's content child is one div holding exactly three p (label, value, caption):
 * polling e2e helpers find the caption p and read the p.tabular-nums beside it. An optional footer (the
 * Withdraw action) is the card's second child.
 */
function StatCard({
  label,
  value,
  caption,
  footer,
}: {
  label: string;
  value: string;
  caption: string;
  footer?: ReactNode;
}) {
  return (
    // No backdrop blur: the page behind the stat cards is a flat color, so the blur shows nothing, and repainting
    // a blurred backdrop around the live Withdraw button made a software-rendered page lag by seconds.
    <Card glow className="min-w-0 backdrop-blur-none!">
      <div className="flex min-w-0 flex-col">
        <p className="text-sm text-muted">{label}</p>
        <p className="mt-2 text-2xl font-semibold leading-tight tabular-nums wrap-break-word">{value}</p>
        <p className="mt-1 text-sm text-muted">{caption}</p>
      </div>
      {footer}
    </Card>
  );
}

/** Stat-shaped skeleton blocks in the same two grids, for the loading state. No label: AsyncBoundary announces. */
export function AccountStatsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className={EARNINGS_GRID}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-36 w-full rounded-2xl" />
        ))}
      </div>
      <div className={ACTIVITY_GRID}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export interface AccountStatsProps {
  /** Counts and the withdrawable balance (useSellerStats). */
  stats: SellerStatsData;
  /** From deriveSales: sales of this wallet's listings. */
  earnedWei: bigint;
  /** From deriveSales: this wallet's withdrawals. */
  withdrawnWei: bigint;
  /** From deriveSales: what this wallet's purchases paid. */
  spentWei: bigint;
  /** Number of purchases (datasets this wallet owns access to). */
  bought: number;
}

/**
 * My Account stat cards. Earned, withdrawable and withdrawn are three independent figures: no sum or difference
 * between them is shown (the held balance is "Held until withdrawn"). Zero values show as 0 / 0 ETH.
 */
export function AccountStats({ stats, earnedWei, withdrawnWei, spentWei, bought }: AccountStatsProps) {
  const { state, run } = useWithdraw();
  const busy = isBusy(state);
  const nothing = stats.withdrawableWei === 0n;

  return (
    <div className="flex flex-col gap-4">
      <div className={EARNINGS_GRID}>
        <StatCard label="Total earned" value={formatEth(earnedWei)} caption="From sales of your listings" />
        <StatCard
          label="Withdrawable balance"
          value={formatEth(stats.withdrawableWei)}
          caption="Held until withdrawn"
          footer={
            <div>
              <Button loading={busy} disabled={nothing} onClick={() => void run()}>
                Withdraw balance
              </Button>
              {nothing ? <p className="mt-2 text-sm text-muted">Nothing to withdraw yet.</p> : null}
            </div>
          }
        />
        <StatCard label="Withdrawn so far" value={formatEth(withdrawnWei)} caption="Already sent to your wallet" />
      </div>
      <TxStatus state={state} onRetry={() => void run()} />
      <div className={ACTIVITY_GRID}>
        <StatCard label="Datasets" value={String(stats.datasets)} caption="Groups of bills" />
        <StatCard label="Listings" value={String(stats.listings)} caption="Datasets for sale" />
        <StatCard label="Sales" value={String(stats.sales)} caption="Purchases of your listings" />
        <StatCard label="Bought" value={String(bought)} caption="Datasets you own access to" />
        <StatCard label="Total spent" value={formatEth(spentWei)} caption={`Across ${plural(bought, "purchase")}`} />
      </div>
    </div>
  );
}
