"use client";

import Link from "next/link";
import { AsyncBoundary } from "@/components/AsyncBoundary";
import { EmptyState } from "@/components/EmptyState";
import { PageShell } from "@/components/PageShell";
import { Skeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { useMyPurchases } from "@/data/hooks";
import { DECRYPT_COMING_LABEL, DECRYPT_HELPER } from "@/lib/copy";
import { formatDate, formatEth, shortHash } from "@/lib/format";

function PurchasesSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
    </div>
  );
}

export default function PurchasesPage() {
  const purchases = useMyPurchases();

  return (
    <PageShell title="My purchases">
      <AsyncBoundary
        query={purchases}
        thing="purchases"
        skeleton={<PurchasesSkeleton />}
        isEmpty={(data) => data.length === 0}
        empty={
          <EmptyState heading="No purchases yet" action={{ label: "Browse datasets", href: "/buy" }}>
            Datasets you buy appear here with your access status.
          </EmptyState>
        }
      >
        {(data) => (
          <ul className="flex flex-col gap-4">
            {data.map((p) => (
              <Card as="li" key={`${p.listingId}-${p.txHash}`} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <Link
                    href={`/buy/${p.listingId}`}
                    className="text-base font-semibold text-text underline-offset-4 hover:underline wrap-break-word"
                  >
                    {p.title}
                  </Link>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-muted">
                    <span>{`Paid ${formatEth(p.priceWei)}`}</span>
                    <span>{formatDate(p.purchasedAt)}</span>
                    <span title={p.txHash} className="font-mono">
                      {shortHash(p.txHash)}
                    </span>
                  </p>
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <div className="flex flex-wrap items-center gap-3">
                    {p.hasAccess ? <StatusChip variant="success">Access granted</StatusChip> : null}
                    <Button variant="secondary" disabled>
                      {DECRYPT_COMING_LABEL}
                    </Button>
                  </div>
                  <p className="text-sm text-muted">{DECRYPT_HELPER}</p>
                </div>
              </Card>
            ))}
          </ul>
        )}
      </AsyncBoundary>
    </PageShell>
  );
}
