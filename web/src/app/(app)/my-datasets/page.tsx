"use client";

import { useMemo } from "react";
import { AsyncBoundary } from "@/components/AsyncBoundary";
import { EmptyState } from "@/components/EmptyState";
import { PageShell } from "@/components/PageShell";
import { BoughtDatasetCard } from "@/components/datasets/BoughtDatasetCard";
import { DATASET_GRID, DatasetGridSkeleton } from "@/components/datasets/DatasetGridSkeleton";
import { ListedDatasetCard, type SalesState } from "@/components/datasets/ListedDatasetCard";
import { useActivity, useMyDatasets, useMyPurchases } from "@/data/hooks";
import { useDataScope } from "@/data/provider";
import { deriveSales, myListingIdsOf } from "@/lib/my-sales";

const NO_PURCHASES: never[] = [];

/**
 * Two independent sections. Listed by me renders from useMyDatasets alone; the Sold line is derived from the
 * activity read, which is read outside the listed AsyncBoundary so a slow or failed scan never blanks the cards.
 * Bought by me renders from useMyPurchases. Each section has its own loading, empty and error state.
 */
export default function MyDatasetsPage() {
  const { address } = useDataScope();
  const datasets = useMyDatasets();
  const purchases = useMyPurchases();
  const activity = useActivity();

  const salesState: SalesState =
    activity.data !== undefined ? "ready" : activity.status === "error" ? "error" : "pending";

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

  return (
    <PageShell title="My Datasets" subtitle="Datasets you listed and datasets you bought.">
      <div className="flex flex-col gap-12">
        <section aria-labelledby="listed-by-me">
          <h2 id="listed-by-me" className="text-lg font-semibold">
            Listed by me
          </h2>
          <div className="mt-4">
            <AsyncBoundary
              query={datasets}
              thing="your datasets"
              skeleton={<DatasetGridSkeleton />}
              isEmpty={(rows) => rows.length === 0}
              empty={
                <EmptyState heading="No datasets yet" action={{ label: "Upload", href: "/upload" }}>
                  Upload your bills to create your first dataset.
                </EmptyState>
              }
            >
              {(rows) => (
                <ul className={DATASET_GRID}>
                  {[...rows]
                    .sort((a, b) => b.createdAt - a.createdAt)
                    .map((d) => (
                      <ListedDatasetCard
                        key={d.id}
                        dataset={d}
                        sales={d.listingId === undefined ? undefined : sales.perListing.get(d.listingId)}
                        salesState={salesState}
                      />
                    ))}
                </ul>
              )}
            </AsyncBoundary>
          </div>
        </section>

        <section aria-labelledby="bought-by-me">
          <h2 id="bought-by-me" className="text-lg font-semibold">
            Bought by me
          </h2>
          <div className="mt-4">
            <AsyncBoundary
              query={purchases}
              thing="your purchases"
              skeleton={<DatasetGridSkeleton />}
              isEmpty={(rows) => rows.length === 0}
              empty={
                <EmptyState heading="No purchases yet" action={{ label: "Browse marketplace", href: "/marketplace" }}>
                  Datasets you buy appear here with your access status.
                </EmptyState>
              }
            >
              {(rows) => (
                <ul className={DATASET_GRID}>
                  {rows.map((p) => (
                    <BoughtDatasetCard key={`${p.listingId}-${p.txHash}`} purchase={p} />
                  ))}
                </ul>
              )}
            </AsyncBoundary>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
