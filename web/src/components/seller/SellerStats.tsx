"use client";

import type { ReactNode } from "react";
import { Skeleton } from "@/components/Skeleton";
import { TxStatus } from "@/components/TxStatus";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useWithdraw } from "@/data/hooks";
import type { SellerStats as SellerStatsData } from "@/data/types";
import { formatEth } from "@/lib/format";
import { isBusy } from "@/lib/tx-machine";

const GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4";

function StatCard({
  label,
  value,
  caption,
  children,
}: {
  label: string;
  value: string;
  caption: string;
  children?: ReactNode;
}) {
  return (
    <Card className="flex flex-col">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-sm text-muted">{caption}</p>
      {children}
    </Card>
  );
}

/** Four stat blocks in the same grid as SellerStats, for the loading state. */
export function SellerStatsSkeleton() {
  return (
    <div className={GRID}>
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-36 w-full rounded-xl" />
      ))}
    </div>
  );
}

/** Dashboard stat cards. The balance card holds the Withdraw balance action. */
export function SellerStats({ stats }: { stats: SellerStatsData }) {
  const { state, run } = useWithdraw();
  const busy = isBusy(state);
  const nothing = stats.withdrawableWei === 0n;

  return (
    <div>
      <div className={GRID}>
        <StatCard label="Datasets" value={String(stats.datasets)} caption="Groups of bills" />
        <StatCard label="Listings" value={String(stats.listings)} caption="Datasets for sale" />
        <StatCard label="Sales" value={String(stats.sales)} caption="Purchases of your listings" />
        <StatCard label="Withdrawable balance" value={formatEth(stats.withdrawableWei)} caption="Held until withdrawn">
          <div className="mt-4">
            <Button loading={busy} disabled={nothing} onClick={() => void run()}>
              Withdraw balance
            </Button>
            {nothing ? <p className="mt-2 text-sm text-muted">Nothing to withdraw yet.</p> : null}
          </div>
        </StatCard>
      </div>
      <TxStatus state={state} onRetry={() => void run()} />
    </div>
  );
}
