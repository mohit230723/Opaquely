"use client";

import { useAccount } from "wagmi";
import { AsyncBoundary } from "@/components/AsyncBoundary";
import { Skeleton } from "@/components/Skeleton";
import { useChainView } from "@/data/hooks";
import type { ChainViewRow } from "@/data/types";
import { categoryLabel } from "@/lib/categories";
import { formatBillAmount, formatDateDays, shortHash } from "@/lib/format";
import { useSessionBills, type SessionBill } from "@/lib/session-bills";

// Moved from the chain-view page (which keeps its own copy until plan 07-08 removes it). The only change is the
// row heading level: here each "Bill N" sits under the step's h2, so it is an h3.

function Handle({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 md:justify-start">
      <dt className="w-16 shrink-0 text-sm text-muted">{label}</dt>
      <dd className="min-w-0 font-mono text-sm" title={value}>
        {shortHash(value)}
      </dd>
    </div>
  );
}

function YouSee({ bill }: { bill: SessionBill | undefined }) {
  if (!bill) return <p className="text-muted">Not available after reload</p>;
  const d = bill.draft;
  return (
    <div>
      <p className="text-base font-semibold wrap-break-word">{d.vendor.trim() === "" ? "No vendor" : d.vendor}</p>
      <p className="mt-1 text-base tabular-nums">{formatBillAmount(d.amountCents)}</p>
      <p className="mt-1 text-sm text-muted">
        {formatDateDays(d.dateDays)} · {categoryLabel(d.category)}
      </p>
    </div>
  );
}

/** One row per bill: what this browser holds in tab memory beside the handles the chain stores. */
export function ChainRows({ rows, session }: { rows: ChainViewRow[]; session: readonly SessionBill[] }) {
  return (
    <div className="md:rounded-xl md:border md:border-border md:bg-surface">
      <div className="hidden gap-6 border-b border-border px-6 py-3 text-sm font-semibold text-muted md:grid md:grid-cols-2">
        <p>What you see (this browser only)</p>
        <p>What the chain sees</p>
      </div>
      <ul>
        {rows.map((row) => {
          const bill = session.find((s) => s.index === row.index);
          return (
            <li
              key={row.index}
              className="mb-4 rounded-xl border border-border bg-surface p-4 md:mb-0 md:rounded-none md:border-0 md:border-t md:border-border md:bg-transparent md:px-6 md:py-4 md:first:border-t-0"
            >
              <h3 className="text-base font-semibold">Bill {row.index + 1}</h3>
              <div className="mt-3 grid gap-4 md:grid-cols-2 md:gap-6">
                <div>
                  <p className="mb-2 text-sm font-semibold text-muted md:hidden">What you see (this browser only)</p>
                  <YouSee bill={bill} />
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold text-muted md:hidden">What the chain sees</p>
                  <dl className="flex flex-col gap-2">
                    <Handle label="Amount" value={row.amountHandle} />
                    <Handle label="Category" value={row.categoryHandle} />
                    <Handle label="Date" value={row.dateHandle} />
                  </dl>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * The chain rows of one dataset: the encrypted handles from the chain beside this tab's plaintext copy of each
 * bill. The plaintext is tab memory only, so after a reload a row says "Not available after reload".
 */
export function DatasetChainView({ datasetId }: { datasetId: string }) {
  const { address } = useAccount();
  const chain = useChainView(datasetId);
  const session = useSessionBills(address, datasetId);
  return (
    <AsyncBoundary
      query={chain}
      thing="encrypted bills"
      skeleton={
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28 w-full" />
        </div>
      }
      isEmpty={(rows) => rows.length === 0}
      empty={<p className="text-muted">No bills recorded yet.</p>}
    >
      {(rows) => <ChainRows rows={rows} session={session} />}
    </AsyncBoundary>
  );
}
