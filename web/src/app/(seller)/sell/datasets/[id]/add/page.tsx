"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useAccount } from "wagmi";
import { EmptyState } from "@/components/EmptyState";
import { AsyncBoundary } from "@/components/AsyncBoundary";
import { PageShell } from "@/components/PageShell";
import { Skeleton } from "@/components/Skeleton";
import { TxStatus } from "@/components/TxStatus";
import { LockIcon } from "@/components/icons";
import { BillReviewForm } from "@/components/seller/BillReviewForm";
import { Dropzone } from "@/components/seller/Dropzone";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAddBill, useDataset } from "@/data/hooks";
import type { BillDraft } from "@/data/types";
import type { OcrState } from "@/lib/use-bill-ocr";
import { plural } from "@/lib/format";
import { networkLabel } from "@/lib/network";
import { isBusy } from "@/lib/tx-machine";
import { useBillOcr } from "@/lib/use-bill-ocr";
import type { BillFormFields } from "@/lib/validate-bill";

function OcrStatus({ state }: { state: OcrState }) {
  if (state.phase === "idle") return null;
  if (state.phase === "failed") {
    return (
      <p role="status" data-testid="ocr-status" className="mt-3 text-sm text-danger">
        {state.reason}
      </p>
    );
  }
  if (state.phase === "done") {
    return (
      <p role="status" data-testid="ocr-status" className="mt-3 text-sm text-muted">
        Read the bill. Check every field before you add it.
      </p>
    );
  }
  const reading = state.status === "recognizing text";
  const pct = reading ? Math.round(state.progress * 100) : undefined;
  return (
    <div data-testid="ocr-status" role="status" className="mt-3">
      <p className="text-sm text-muted">{reading ? `Reading the bill, ${pct}%` : "Loading the reader"}</p>
      <div
        role="progressbar"
        aria-label="OCR progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="mt-2 h-2 overflow-hidden rounded-full bg-surface-raised"
      >
        <div className="h-full bg-accent transition-[width]" style={{ width: `${pct ?? 5}%` }} />
      </div>
    </div>
  );
}

export default function AddBillPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const dataset = useDataset(id);

  return (
    <PageShell title="Add a bill">
      <AsyncBoundary query={dataset} thing="dataset" skeleton={<Skeleton className="h-96 w-full" />}>
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
  const { chainId } = useAccount();
  const localMock = networkLabel(chainId) === "Local FHEVM mock";
  const [resetKey, setResetKey] = useState(0);
  const [last, setLast] = useState<{ draft: BillDraft; index: number } | null>(null);
  const [prefill, setPrefill] = useState<{ n: number; fields: BillFormFields } | undefined>();
  const ocr = useBillOcr((p) =>
    setPrefill((prev) => ({
      n: (prev?.n ?? 0) + 1,
      fields: { vendor: p.vendor, amount: p.amount, date: p.date, category: p.category },
    })),
  );

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
    setPrefill(undefined);
    ocr.reset();
    setResetKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4">
        <LockIcon className="mt-0.5 shrink-0 text-accent-bright" />
        <div className="text-sm">
          <p>
            {localMock
              ? "Local FHEVM mock: the image and the vendor stay in this browser, but this local test node receives the amount, date and category in cleartext. Use a sample bill or made-up values, never a real bill."
              : "The image and the vendor stay in this browser. The amount, date and category are encrypted before they leave it."}
          </p>
          <p className="mt-1 text-muted">
            Choose an image or a sample bill to read it in this browser, then check every field before you add it. You can also type the fields by hand.
          </p>
        </div>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div>
          <Dropzone
            key={resetKey}
            onImageChange={(url) => {
              if (url) void ocr.run(url);
              else ocr.reset();
            }}
          />
          <OcrStatus state={ocr.state} />
        </div>
        <Card>
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
            <BillReviewForm onSubmit={submit} busy={busy} resetKey={`${resetKey}-${prefill?.n ?? 0}`} initial={prefill?.fields} />
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
