"use client";

import { useParams } from "next/navigation";
import { AsyncBoundary } from "@/components/AsyncBoundary";
import { EmptyState } from "@/components/EmptyState";
import { PageShell } from "@/components/PageShell";
import { Skeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusChip, type StatusChipVariant } from "@/components/ui/StatusChip";
import { useDataset } from "@/data/hooks";
import type { Dataset, DatasetStatus } from "@/data/types";
import { MIN_BILLS_TO_LIST } from "@/lib/constants";
import { formatEth } from "@/lib/format";

const STATUS: Record<DatasetStatus, { label: string; variant: StatusChipVariant }> = {
  open: { label: "Open", variant: "neutral" },
  sealed: { label: "Sealed", variant: "info" },
  listed: { label: "Listed", variant: "success" },
};

export default function DatasetDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const dataset = useDataset(id);
  const loaded = dataset.data ?? null;

  const title = loaded ? (
    <span className="flex flex-wrap items-center gap-3">
      <span className="wrap-break-word">{loaded.name}</span>
      <StatusChip variant={STATUS[loaded.status].variant}>{STATUS[loaded.status].label}</StatusChip>
    </span>
  ) : (
    "Dataset"
  );

  return (
    <PageShell title={title}>
      <AsyncBoundary query={dataset} thing="dataset" skeleton={<Skeleton className="h-40 w-full" />}>
        {(data) =>
          data === null ? (
            <EmptyState heading="Dataset not found" action={{ label: "My datasets", href: "/sell/datasets" }}>
              Check the link or go back to your datasets.
            </EmptyState>
          ) : (
            <DatasetDetail dataset={data} />
          )
        }
      </AsyncBoundary>
    </PageShell>
  );
}

function DatasetDetail({ dataset }: { dataset: Dataset }) {
  const base = `/sell/datasets/${dataset.id}`;
  const isOpen = dataset.status === "open";
  const listed = dataset.status === "listed";
  const underMinimum = dataset.billCount < MIN_BILLS_TO_LIST;

  if (dataset.billCount === 0) {
    return (
      <EmptyState
        heading="No bills in this dataset"
        action={isOpen ? { label: "Add bill", href: `${base}/add` } : undefined}
      >
        Add at least {MIN_BILLS_TO_LIST} bills, then list it for sale.
      </EmptyState>
    );
  }

  return (
    <Card className="max-w-2xl">
      {listed ? (
        dataset.priceWei !== undefined ? (
          <p className="text-lg font-semibold">
            Price <span className="text-accent-bright">{formatEth(dataset.priceWei)}</span>
          </p>
        ) : null
      ) : (
        <p className="text-lg font-semibold">
          {dataset.billCount} of {MIN_BILLS_TO_LIST} bills needed to list
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {isOpen ? <Button href={`${base}/add`}>Add bill</Button> : null}
        {isOpen ? (
          <span className="inline-flex flex-wrap items-center gap-3">
            <Button variant="secondary" href={`${base}/list`} disabled={underMinimum}>
              List dataset
            </Button>
            {underMinimum ? <span className="text-sm text-muted">Needs {MIN_BILLS_TO_LIST} bills</span> : null}
          </span>
        ) : null}
        <Button variant="secondary" href={`${base}/chain-view`}>
          Chain view
        </Button>
      </div>
    </Card>
  );
}
