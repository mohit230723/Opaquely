"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { useMyDatasets, useSellerStats } from "@/data/hooks";
import { AsyncBoundary } from "@/components/AsyncBoundary";
import { EmptyState } from "@/components/EmptyState";
import { PageShell } from "@/components/PageShell";
import { Skeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/Button";
import { DatasetList } from "@/components/seller/DatasetList";
import { SellerStats, SellerStatsSkeleton } from "@/components/seller/SellerStats";

export default function SellerHomePage() {
  const { address } = useAccount();
  const stats = useSellerStats();
  const datasets = useMyDatasets();

  return (
    <PageShell title="Seller dashboard" actions={<Button href="/sell/datasets/new">Create dataset</Button>}>
      {!address ? (
        <p className="text-muted">Connect your wallet to continue.</p>
      ) : (
        <div className="flex flex-col gap-10">
          <AsyncBoundary query={stats} thing="seller stats" skeleton={<SellerStatsSkeleton />}>
            {(data) => <SellerStats stats={data} />}
          </AsyncBoundary>

          <section aria-labelledby="recent-datasets">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="recent-datasets" className="text-lg font-semibold">
                Recent datasets
              </h2>
              <Link
                href="/sell/datasets"
                className="inline-flex min-h-11 items-center rounded-lg border border-border-strong px-4 text-base font-semibold text-text hover:bg-surface-raised"
              >
                View all datasets
              </Link>
            </div>
            <div className="mt-4">
              <AsyncBoundary
                query={datasets}
                thing="datasets"
                skeleton={
                  <div className="flex flex-col gap-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                }
                isEmpty={(rows) => rows.length === 0}
                empty={
                  <EmptyState heading="No datasets yet" action={{ label: "Create dataset", href: "/sell/datasets/new" }}>
                    Create a dataset to start adding bills.
                  </EmptyState>
                }
              >
                {(rows) => <DatasetList datasets={rows} limit={3} />}
              </AsyncBoundary>
            </div>
          </section>
        </div>
      )}
    </PageShell>
  );
}
