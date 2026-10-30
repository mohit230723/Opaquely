"use client";

import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { AsyncBoundary } from "@/components/AsyncBoundary";
import { EmptyState } from "@/components/EmptyState";
import { PageShell } from "@/components/PageShell";
import { ListingFilters } from "@/components/buyer/ListingFilters";
import { MarketplaceCard } from "@/components/marketplace/MarketplaceCard";
import { MARKETPLACE_GRID, MarketplaceGridSkeleton } from "@/components/marketplace/MarketplaceGridSkeleton";
import { useListings, useMyPurchases } from "@/data/hooks";
import type { ListingFilter } from "@/data/types";
import { applyListingFilter } from "@/lib/filter-listings";

export default function MarketplacePage() {
  const { address } = useAccount();
  const listings = useListings();
  // One read for the bought state of every card (not a hasAccess read per card).
  const purchases = useMyPurchases();
  const [filter, setFilter] = useState<ListingFilter>({ categories: [] });

  // undefined while the purchases read is loading (cards show a placeholder instead of Buy). A failed first
  // read counts as "nothing bought": Buy stays available, and the contract rejects a second purchase anyway.
  const boughtIds = useMemo(() => {
    if (purchases.data) return new Set(purchases.data.map((p) => p.listingId));
    if (purchases.isError) return new Set<string>();
    return undefined;
  }, [purchases.data, purchases.isError]);

  return (
    <PageShell
      title="Marketplace"
      subtitle="Encrypted datasets from other sellers. Buyers get insights, never single bills."
    >
      <div className="flex flex-col gap-6">
        <ListingFilters filter={filter} onChange={setFilter} />
        <AsyncBoundary
          query={listings}
          thing="datasets"
          skeleton={<MarketplaceGridSkeleton />}
          isEmpty={(data) => data.length === 0}
          empty={
            <EmptyState heading="No datasets for sale yet" action={{ label: "Upload", href: "/upload" }}>
              Sellers list their encrypted datasets here. Check back soon.
            </EmptyState>
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
                  <ul className={MARKETPLACE_GRID}>
                    {results.map((l) => (
                      <MarketplaceCard
                        key={l.id}
                        listing={l}
                        viewer={address}
                        bought={boughtIds === undefined ? undefined : boughtIds.has(l.id)}
                        onSettled={() => void purchases.refetch()}
                      />
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
