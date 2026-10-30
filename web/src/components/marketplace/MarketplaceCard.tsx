"use client";

import { useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/Skeleton";
import { CheckIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import type { Listing } from "@/data/types";
import { categoryLabel } from "@/lib/categories";
import { CATEGORIES_NOT_DECLARED } from "@/lib/copy";
import { formatEth, plural, shortAddress } from "@/lib/format";
import { BuyDialog, panelKey } from "./BuyDialog";

const MAX_CHIPS = 3;
const CHIP =
  "inline-flex h-8 items-center rounded-full border border-border bg-surface-raised px-3 text-sm text-[#a5d8ff]";

export interface MarketplaceCardProps {
  listing: Listing;
  /** The connected wallet. */
  viewer: string | undefined;
  /** Whether this wallet already bought the listing (from useMyPurchases). undefined while that read loads. */
  bought: boolean | undefined;
  /** Re-reads the wallet's purchases after a buy attempt settles. */
  onSettled: () => void;
}

/**
 * One listing as a GlowCard. The title is the only link (to the detail page); the card itself is never a link,
 * so the Buy button is not nested in an anchor. No bill data: only title, seller, description, categories,
 * record count and price.
 */
export function MarketplaceCard({ listing, viewer, bought, onSettled }: MarketplaceCardProps) {
  const own = viewer !== undefined && viewer.toLowerCase() === listing.seller.toLowerCase();
  const shown = listing.categories.slice(0, MAX_CHIPS);
  const extra = listing.categories.length - shown.length;

  return (
    <Card as="li" glow data-testid="listing-card" className="min-w-0">
      <div className="flex min-w-0 flex-col gap-3">
        <h2 className="line-clamp-2 text-base font-semibold wrap-break-word">
          <Link href={`/marketplace/${listing.id}`} className="hover:underline">
            {listing.title}
          </Link>
        </h2>
        <p className="font-mono text-sm text-muted" title={listing.seller}>
          {shortAddress(listing.seller)}
        </p>
        <p className="line-clamp-3 text-base wrap-break-word">{listing.description}</p>
        <div className="flex flex-wrap gap-2">
          {shown.map((c) => (
            <span key={c} className={CHIP}>
              {categoryLabel(c)}
            </span>
          ))}
          {extra > 0 ? <span className={CHIP}>+{extra}</span> : null}
          {listing.categories.length === 0 ? (
            <span className={CHIP.replace("text-[#a5d8ff]", "text-muted")}>{CATEGORIES_NOT_DECLARED}</span>
          ) : null}
        </div>
        <div className="mt-auto flex items-end justify-between gap-4 pt-2">
          <span className="text-sm text-muted">{plural(listing.recordCount, "bill")}</span>
          <span className="text-2xl font-semibold leading-tight tabular-nums">{formatEth(listing.priceWei)}</span>
        </div>
      </div>
      {/* Keyed by wallet and listing: a wallet switch remounts the footer, so an open dialog, a confirmed or
          failed purchase from the previous wallet cannot carry over. */}
      <CardFooter
        key={panelKey(viewer, listing.id)}
        listing={listing}
        own={own}
        bought={bought}
        onSettled={onSettled}
      />
    </Card>
  );
}

function CardFooter({
  listing,
  own,
  bought,
  onSettled,
}: {
  listing: Listing;
  own: boolean;
  bought: boolean | undefined;
  onSettled: () => void;
}) {
  const [open, setOpen] = useState(false);
  // The dialog (and its transaction hook) mounts on the first press only, so a grid of cards holds no
  // purchase state until a buyer asks for it. It stays mounted when the card flips to Access granted, so the
  // success message stays readable.
  const [mounted, setMounted] = useState(false);

  let action;
  if (own) {
    action = <StatusChip variant="info">Your listing</StatusChip>;
  } else if (bought === undefined) {
    action = <Skeleton className="h-11 w-full" />;
  } else if (bought) {
    action = (
      <div className="flex flex-col items-start gap-3">
        <StatusChip variant="success">
          <CheckIcon width={14} height={14} />
          Access granted
        </StatusChip>
        <Button variant="secondary" href="/my-datasets" className="w-full">
          View in My Datasets
        </Button>
      </div>
    );
  } else {
    action = (
      <Button
        className="w-full"
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
      >
        Buy this dataset
      </Button>
    );
  }

  return (
    <div>
      {action}
      {mounted ? (
        <BuyDialog
          listing={listing}
          open={open}
          owned={bought}
          onClose={() => setOpen(false)}
          onSettled={onSettled}
        />
      ) : null}
    </div>
  );
}
