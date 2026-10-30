"use client";

import { useMemo } from "react";
import { AccountStats, AccountStatsSkeleton } from "@/components/account/AccountStats";
import { WalletCard } from "@/components/account/WalletCard";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { AsyncBoundary } from "@/components/AsyncBoundary";
import { EmptyState } from "@/components/EmptyState";
import { PageShell } from "@/components/PageShell";
import { Skeleton } from "@/components/Skeleton";
import { Card } from "@/components/ui/Card";
import { useActivity, useMyDatasets, useMyPurchases, useSellerStats } from "@/data/hooks";
import { useDataScope } from "@/data/provider";
import { shortAddress } from "@/lib/format";
import { deriveSales, myListingIdsOf } from "@/lib/my-sales";
import { networkLabel } from "@/lib/network";

const NO_PURCHASES: never[] = [];

function ActivitySkeleton() {
  return (
    <Card>
      <div className="flex flex-col gap-6">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-start gap-4">
            <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/**
 * My Account: who this wallet is, what it earned, what it can withdraw, what it spent and bought, and its
 * transactions. Every derived figure comes from deriveSales over reads that already exist. The stats render
 * from useSellerStats; earned, withdrawn and spent fill in from the activity and purchase reads, and a failed
 * activity read leaves them at 0 ETH without blanking the page.
 */
export default function AccountPage() {
  const { address, chainId } = useDataScope();
  const stats = useSellerStats();
  const datasets = useMyDatasets();
  const purchases = useMyPurchases();
  const activity = useActivity();

  const sales = useMemo(
    () =>
      deriveSales({
        me: address,
        myListingIds: myListingIdsOf(datasets.data ?? []),
        events: activity.data ?? [],
        purchases: purchases.data ?? NO_PURCHASES,
      }),
    [address, datasets.data, activity.data, purchases.data],
  );
  const bought = (purchases.data ?? NO_PURCHASES).length;

  const subtitle = (
    <>
      {address ? (
        <span className="font-mono" title={address}>
          {shortAddress(address)}
        </span>
      ) : null}
      {address ? <span aria-hidden="true"> · </span> : null}
      <span>{networkLabel(chainId)}</span>
    </>
  );

  return (
    <PageShell title="My Account" subtitle={subtitle}>
      <div className="flex flex-col gap-10">
        <WalletCard address={address} chainId={chainId} />

        <AsyncBoundary query={stats} thing="your account" skeleton={<AccountStatsSkeleton />}>
          {(data) => (
            <AccountStats
              stats={data}
              earnedWei={sales.totalEarnedWei}
              withdrawnWei={sales.totalWithdrawnWei}
              spentWei={sales.totalSpentWei}
              bought={bought}
            />
          )}
        </AsyncBoundary>

        <section aria-labelledby="transactions">
          <h2 id="transactions" className="text-lg font-semibold">
            Transactions
          </h2>
          <div className="mt-4">
            <AsyncBoundary
              query={activity}
              thing="activity"
              skeleton={<ActivitySkeleton />}
              isEmpty={(data) => data.length === 0}
              empty={<EmptyState heading="No activity yet">Listings, purchases and withdrawals show up here.</EmptyState>}
            >
              {(data) => <ActivityTimeline events={data} me={address} />}
            </AsyncBoundary>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
