"use client";

import { useId } from "react";
import Link from "next/link";
import { CheckIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import type { Purchase } from "@/data/types";
import { formatDate, formatEth, shortAddress, shortHash } from "@/lib/format";

/** Analytics arrive in Milestone 2. Until then the button is present, blocked, and says why. */
export const VIEW_ANALYTICS_HELPER = "Coming in Milestone 2.";

/**
 * One dataset this wallet bought, as a GlowCard. It shows only the purchase record (title, price paid, date,
 * seller, transaction, access). View Analytics is a placeholder: no number sits behind it.
 */
export function BoughtDatasetCard({ purchase }: { purchase: Purchase }) {
  const helperId = useId();

  return (
    <Card as="li" glow data-testid="bought-dataset" className="min-w-0">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 className="min-w-0 text-base font-semibold wrap-break-word">
            <Link href={`/marketplace/${purchase.listingId}`} className="hover:underline">
              {purchase.title}
            </Link>
          </h3>
          {purchase.hasAccess ? (
            <StatusChip variant="success">
              <CheckIcon width={14} height={14} />
              Access granted
            </StatusChip>
          ) : null}
        </div>
        <p className="text-2xl font-semibold leading-tight tabular-nums">{`Paid ${formatEth(purchase.priceWei)}`}</p>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">Date</dt>
          <dd>{formatDate(purchase.purchasedAt)}</dd>
          <dt className="text-muted">Seller</dt>
          <dd className="font-mono" title={purchase.seller}>
            {shortAddress(purchase.seller)}
          </dd>
          <dt className="text-muted">Transaction</dt>
          <dd className="font-mono" title={purchase.txHash}>
            {shortHash(purchase.txHash)}
          </dd>
        </dl>
      </div>
      <div className="flex flex-col items-start gap-2">
        <Button variant="secondary" disabled aria-describedby={helperId}>
          View Analytics
        </Button>
        <p id={helperId} className="text-sm text-muted">
          {VIEW_ANALYTICS_HELPER}
        </p>
      </div>
    </Card>
  );
}
