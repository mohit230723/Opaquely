"use client";

import { useParams } from "next/navigation";
import { AsyncBoundary } from "@/components/AsyncBoundary";
import { EmptyState } from "@/components/EmptyState";
import { PageShell } from "@/components/PageShell";
import { Skeleton } from "@/components/Skeleton";
import { PurchasePanel } from "@/components/buyer/PurchasePanel";
import { CheckIcon, XIcon } from "@/components/icons";
import { Card } from "@/components/ui/Card";
import { useListing } from "@/data/hooks";
import type { Listing } from "@/data/types";
import { categoryLabel } from "@/lib/categories";
import { BUYER_GETS, BUYER_NOT_GETS, BUYER_PROMISE, CATEGORIES_NOT_DECLARED, CATEGORIES_SELLER_DECLARED } from "@/lib/copy";
import { plural, shortAddress } from "@/lib/format";

function DetailSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <Skeleton className="h-40 w-full lg:col-start-3 lg:row-start-1" />
      <div className="flex flex-col gap-6 lg:col-span-2 lg:col-start-1 lg:row-start-1">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    </div>
  );
}

function ListingDetail({ listing }: { listing: Listing }) {
  return (
    <PageShell
      title={listing.title}
      subtitle={
        <>
          Sold by{" "}
          <span className="font-mono text-sm" title={listing.seller}>
            {shortAddress(listing.seller)}
          </span>
        </>
      }
    >
      <div className="grid gap-8 lg:grid-cols-3">
        <aside className="lg:col-start-3 lg:row-start-1 lg:self-start lg:sticky lg:top-24">
          <PurchasePanel listing={listing} />
        </aside>

        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2 lg:col-start-1 lg:row-start-1">
          <p className="text-base wrap-break-word">{listing.description}</p>

          <Card>
            <h2 className="text-base font-semibold">What you get</h2>
            <p className="mt-2 text-base">{BUYER_PROMISE}</p>
            <ul className="mt-4 flex flex-col gap-2">
              {BUYER_GETS.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <CheckIcon className="shrink-0 text-success" />
                  {item}
                </li>
              ))}
            </ul>
            <h3 className="mt-6 text-base font-semibold">What you do not get</h3>
            <ul className="mt-2 flex flex-col gap-2">
              {BUYER_NOT_GETS.map((item) => (
                <li key={item} className="flex items-center gap-2 text-muted">
                  <XIcon className="shrink-0 text-danger" />
                  {item}
                </li>
              ))}
            </ul>
          </Card>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {listing.categories.length === 0 ? (
                <span className="inline-flex h-8 items-center rounded-full border border-border bg-surface-raised px-3 text-sm text-muted">
                  {CATEGORIES_NOT_DECLARED}
                </span>
              ) : null}
              {listing.categories.map((c) => (
                <span
                  key={c}
                  className="inline-flex h-8 items-center rounded-full border border-border bg-surface-raised px-3 text-sm text-[#a5d8ff]"
                >
                  {categoryLabel(c)}
                </span>
              ))}
              <span className="text-sm text-muted">{plural(listing.recordCount, "bill")}</span>
            </div>
            <p className="text-sm text-muted">{CATEGORIES_SELLER_DECLARED}</p>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

export default function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  const listing = useListing(params.id);

  return (
    <AsyncBoundary
      query={listing}
      thing="listing"
      skeleton={
        <PageShell title="Dataset">
          <DetailSkeleton />
        </PageShell>
      }
    >
      {(data) =>
        data === null ? (
          <PageShell title="Dataset">
            <EmptyState heading="Listing not found" action={{ label: "Browse marketplace", href: "/marketplace" }}>
              It may have been removed. Browse the available datasets.
            </EmptyState>
          </PageShell>
        ) : (
          <ListingDetail listing={data} />
        )
      }
    </AsyncBoundary>
  );
}
