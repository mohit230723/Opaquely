"use client";

import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { AsyncBoundary } from "@/components/AsyncBoundary";
import { EmptyState } from "@/components/EmptyState";
import { PageShell } from "@/components/PageShell";
import { Skeleton } from "@/components/Skeleton";
import { LockIcon } from "@/components/icons";
import { useChainView } from "@/data/hooks";
import type { ChainViewRow } from "@/data/types";
import { categoryLabel } from "@/lib/categories";
import { formatBillAmount, formatDateDays, shortHash } from "@/lib/format";
import { useSessionBills, type SessionBill } from "@/lib/session-bills";

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

function ChainRows({ rows, session }: { rows: ChainViewRow[]; session: readonly SessionBill[] }) {
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
              <h2 className="text-base font-semibold">Bill {row.index + 1}</h2>
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

export default function ChainViewPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { address } = useAccount();
  const chain = useChainView(id);
  const session = useSessionBills(address, id);

  return (
    <PageShell title="What the chain sees vs what you see">
      <p className="mb-6 flex max-w-2xl items-start gap-3 rounded-lg border border-border bg-surface p-4 text-muted">
        <LockIcon className="mt-0.5 shrink-0 text-accent-bright" aria-hidden="true" />
        <span>
          The chain stores encrypted handles. A handle is a reference to a ciphertext, and the value cannot be read from
          it.
        </span>
      </p>
      <AsyncBoundary
        query={chain}
        thing="chain view"
        skeleton={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        }
        isEmpty={(rows) => rows.length === 0}
        empty={
          <EmptyState heading="No bills recorded yet" action={{ label: "Add bill", href: `/sell/datasets/${id}/add` }}>
            Bills you add appear here next to the handles stored on-chain. Values you typed are cleared when you reload the
            page.
          </EmptyState>
        }
      >
        {(rows) => <ChainRows rows={rows} session={session} />}
      </AsyncBoundary>
    </PageShell>
  );
}
