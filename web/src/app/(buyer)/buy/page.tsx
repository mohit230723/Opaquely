"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { AsyncBoundary } from "@/components/AsyncBoundary";
import { EmptyState } from "@/components/EmptyState";
import { PageShell } from "@/components/PageShell";
import { Skeleton } from "@/components/Skeleton";
import { ListingCard } from "@/components/buyer/ListingCard";
import { ListingFilters } from "@/components/buyer/ListingFilters";
import { useListings } from "@/data/hooks";
import type { ListingFilter } from "@/data/types";
import { applyListingFilter } from "@/lib/filter-listings";

// Fixed column tracks (3 from 1024px, 2 from 640px, 1 below) so a single card is not stretched.
const GRID =
  "grid grid-cols-1 gap-6 sm:grid-cols-[repeat(2,minmax(0,22rem))] lg:grid-cols-[repeat(3,minmax(0,22rem))]";

function ListingsSkeleton() {
  return (
    <div className={GRID}>
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-64 w-full" />
      ))}
    </div>
  );
}

export default function ListingsPage() {
  const { address } = useAccount();
  const listings = useListings();
  const [filter, setFilter] = useState<ListingFilter>({ categories: [] });

  return (
    <PageShell
      title="Datasets for sale"
      subtitle="Encrypted aggregate insights from sellers' bills. Raw bills are never shown."
    >
      <div className="flex flex-col gap-6">
        <ListingFilters filter={filter} onChange={setFilter} />
        <AsyncBoundary
          query={listings}
          thing="datasets"
          skeleton={<ListingsSkeleton />}
          isEmpty={(data) => data.length === 0}
          empty={
            <EmptyState heading="No datasets for sale yet">Sellers list sealed datasets here. Check back soon.</EmptyState>
          }
        >
          {(data) => {
            const results = applyListingFilter(data, filter);
            return (
              <div className="flex flex-col gap-6">
                <p aria-live="polite" className="text-sm text-muted">
                  {`Showing ${results.length} of ${data.length} ${data.length === 1 ? "dataset" : "datasets"}`}
                </p>
                {results.length === 0 ? (
                  <EmptyState
                    heading="No datasets match your filters"
                    action={{ label: "Clear filters", onClick: () => setFilter({ categories: [] }) }}
                  >
                    Try a different search or clear the filters.
                  </EmptyState>
                ) : (
                  <ul className={GRID}>
                    {results.map((l) => (
                      <li key={l.id}>
                        <ListingCard listing={l} viewer={address} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          }}
        </AsyncBoundary>
      </div>
    </PageShell>
  );
}
