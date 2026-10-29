"use client";

import { useAccount } from "wagmi";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { AsyncBoundary } from "@/components/AsyncBoundary";
import { EmptyState } from "@/components/EmptyState";
import { PageShell } from "@/components/PageShell";
import { Skeleton } from "@/components/Skeleton";
import { SellerStats, SellerStatsSkeleton } from "@/components/seller/SellerStats";
import { Card } from "@/components/ui/Card";
import { useActivity, useSellerStats } from "@/data/hooks";

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

// Interim body (plan 07-01): the old /sell stats with Withdraw, then the old /activity timeline.
// Plan 07-07 rebuilds this page.
export default function AccountPage() {
  const { address } = useAccount();
  const stats = useSellerStats();
  const activity = useActivity();

  return (
    <PageShell title="My Account">
      <div className="flex flex-col gap-10">
        <AsyncBoundary query={stats} thing="seller stats" skeleton={<SellerStatsSkeleton />}>
          {(data) => <SellerStats stats={data} />}
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
