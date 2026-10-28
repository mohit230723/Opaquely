"use client";

import { useAccount } from "wagmi";
import { useMyDatasets } from "@/data/hooks";
import type { DatasetStatus } from "@/data/types";
import { AsyncBoundary } from "@/components/AsyncBoundary";
import { EmptyState } from "@/components/EmptyState";
import { PageShell } from "@/components/PageShell";
import { Skeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusChip, type StatusChipVariant } from "@/components/ui/StatusChip";
import { formatDate, plural } from "@/lib/format";

const STATUS: Record<DatasetStatus, { label: string; variant: StatusChipVariant }> = {
  open: { label: "Open", variant: "neutral" },
  sealed: { label: "Sealed", variant: "info" },
  listed: { label: "Listed", variant: "success" },
};

export default function SellerHomePage() {
  const { address } = useAccount();
  const datasets = useMyDatasets();

  return (
    <PageShell title="Seller dashboard" actions={<Button href="/sell/datasets/new">Create dataset</Button>}>
      {!address ? (
        <p className="text-muted">Connect your wallet to continue.</p>
      ) : (
        <AsyncBoundary
          query={datasets}
          thing="datasets"
          skeleton={
            <div className="flex flex-col gap-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          }
          isEmpty={(rows) => rows.length === 0}
          empty={
            <EmptyState heading="No datasets yet" action={{ label: "Create dataset", href: "/sell/datasets/new" }}>
              Create a dataset to start adding bills.
            </EmptyState>
          }
        >
          {(rows) => (
            <ul className="flex flex-col gap-4">
              {rows.map((d) => (
                <Card as="li" key={d.id} className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-base font-semibold wrap-break-word">{d.name}</p>
                    <p className="text-sm text-muted">
                      {plural(d.billCount, "bill")} · {formatDate(d.createdAt)}
                    </p>
                  </div>
                  <StatusChip variant={STATUS[d.status].variant}>{STATUS[d.status].label}</StatusChip>
                </Card>
              ))}
            </ul>
          )}
        </AsyncBoundary>
      )}
    </PageShell>
  );
}
