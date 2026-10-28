"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { AsyncBoundary } from "@/components/AsyncBoundary";
import { PageShell } from "@/components/PageShell";
import { Skeleton } from "@/components/Skeleton";
import { TxStatus } from "@/components/TxStatus";
import { LockIcon } from "@/components/icons";
import { BillReviewForm } from "@/components/seller/BillReviewForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAddBill, useDataset } from "@/data/hooks";
import type { BillDraft } from "@/data/types";
import { plural } from "@/lib/format";
import { isBusy } from "@/lib/tx-machine";

export default function AddBillPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const dataset = useDataset(id);

  return (
    <PageShell title="Add a bill">
      <AsyncBoundary query={dataset} thing="dataset" skeleton={<Skeleton className="h-96 w-full max-w-xl" />}>
        {(data) => {
          if (data === null) {
            return (
              <EmptyState heading="Dataset not found" action={{ label: "My datasets", href: "/sell/datasets" }}>
                Check the link or go back to your datasets.
              </EmptyState>
            );
          }
          if (data.status !== "open") {
            return (
              <EmptyState heading="This dataset is sealed" action={{ label: "Create dataset", href: "/sell/datasets/new" }}>
                Sealed datasets cannot take new bills. Create a new dataset to add more.
              </EmptyState>
            );
          }
          return <AddBillScreen datasetId={id} billCount={data.billCount} />;
        }}
      </AsyncBoundary>
    </PageShell>
  );
}

function AddBillScreen({ datasetId, billCount }: { datasetId: string; billCount: number }) {
  const { state, run, reset } = useAddBill(datasetId);
  const [resetKey, setResetKey] = useState(0);
  const [last, setLast] = useState<{ draft: BillDraft; index: number } | null>(null);

  const busy = isBusy(state);
  const confirmed = state.phase === "confirmed";

  function submit(draft: BillDraft) {
    if (busy) return;
    const input = { draft, index: billCount };
    setLast(input);
    void run(input);
  }

  function addAnother() {
    reset();
    setLast(null);
    setResetKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4">
        <LockIcon className="mt-0.5 shrink-0 text-accent-bright" />
        <div className="text-sm">
          <p>Local only: the image and these fields stay in your browser until they are encrypted.</p>
          <p className="mt-1 text-muted">Reading the bill automatically arrives in a later phase. Fill in the fields from your bill.</p>
        </div>
      </div>
      <div className="grid gap-6">
        <Card className="max-w-xl">
          {confirmed ? (
            <div>
              <p className="text-lg font-semibold">
                Bill added. This dataset now has {plural((last?.index ?? billCount) + 1, "bill")}.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={addAnother}>Add another bill</Button>
                <Button variant="secondary" href={`/sell/datasets/${datasetId}`}>
                  Back to dataset
                </Button>
              </div>
            </div>
          ) : (
            <BillReviewForm onSubmit={submit} busy={busy} resetKey={resetKey} />
          )}
          <TxStatus
            state={state}
            onRetry={() => {
              if (last) void run(last);
            }}
          />
        </Card>
      </div>
    </div>
  );
}
