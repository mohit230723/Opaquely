"use client";

import Link from "next/link";
import { StatusChip } from "@/components/ui/StatusChip";
import type { Listing } from "@/data/types";
import { categoryLabel } from "@/lib/categories";
import { formatEth, plural, shortAddress } from "@/lib/format";

const MAX_CHIPS = 3;
const CHIP =
  "inline-flex h-8 items-center rounded-full border border-border bg-surface-raised px-3 text-sm text-[#a5d8ff]";

/** One listing as a single link target. No bill data: only title, seller, categories, count and price. */
export function ListingCard({ listing, viewer }: { listing: Listing; viewer?: string }) {
  const own = viewer !== undefined && viewer.toLowerCase() === listing.seller.toLowerCase();
  const shown = listing.categories.slice(0, MAX_CHIPS);
  const extra = listing.categories.length - shown.length;

  return (
    <Link
      href={`/buy/${listing.id}`}
      className="flex h-full flex-col gap-3 rounded-xl border border-border bg-surface p-4 transition-colors duration-150 hover:border-border-strong sm:p-6"
    >
      <span className="line-clamp-2 text-base font-semibold wrap-break-word">{listing.title}</span>
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm text-muted" title={listing.seller}>
          {shortAddress(listing.seller)}
        </span>
        {own ? <StatusChip variant="info">Your listing</StatusChip> : null}
      </span>
      <span className="flex flex-wrap gap-2">
        {shown.map((c) => (
          <span key={c} className={CHIP}>
            {categoryLabel(c)}
          </span>
        ))}
        {extra > 0 ? <span className={CHIP}>+{extra}</span> : null}
      </span>
      <span className="mt-auto flex items-end justify-between gap-4 pt-2">
        <span className="text-sm text-muted">{plural(listing.recordCount, "bill")}</span>
        <span className="text-2xl font-semibold leading-tight">{formatEth(listing.priceWei)}</span>
      </span>
      <span className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-border-strong text-base font-semibold">
        View details
      </span>
    </Link>
  );
}
