"use client";

import { useMemo, useState } from "react";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/Button";
import type { ActivityEvent } from "@/data/types";

/** How many transactions show at first, and how many more each Show more transactions reveals. */
export const TRANSACTIONS_PAGE = 20;

/**
 * This wallet's history (deriveSales myHistory) on the existing ActivityTimeline, newest first. The latest 20 show
 * first; beyond that a polite "Showing {shown} of {n} transactions" line and a secondary Show more transactions
 * button reveal 20 more at a time (client-side, no new query). Both are hidden at 20 or fewer.
 */
export function TransactionsPanel({ events, me }: { events: ActivityEvent[]; me: string | undefined }) {
  const [shown, setShown] = useState(TRANSACTIONS_PAGE);
  const sorted = useMemo(() => [...events].sort((a, b) => b.at - a.at), [events]);

  if (sorted.length === 0) {
    return <EmptyState heading="No activity yet">Listings, purchases and withdrawals show up here.</EmptyState>;
  }

  const visible = sorted.slice(0, shown);
  const more = sorted.length > visible.length;

  return (
    <div className="flex flex-col gap-4">
      <ActivityTimeline events={visible} me={me} />
      {more ? (
        <div className="flex flex-wrap items-center gap-4">
          <p aria-live="polite" className="text-sm text-muted">
            {`Showing ${visible.length} of ${sorted.length} transactions`}
          </p>
          <Button variant="secondary" onClick={() => setShown((n) => n + TRANSACTIONS_PAGE)}>
            Show more transactions
          </Button>
        </div>
      ) : null}
    </div>
  );
}
