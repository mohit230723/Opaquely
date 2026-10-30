"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { TxStatus } from "@/components/TxStatus";
import { LockIcon } from "@/components/icons";
import { BillReviewForm } from "@/components/seller/BillReviewForm";
import { Dropzone } from "@/components/seller/Dropzone";
import { SentCheckPanel, type SentCheck } from "@/components/seller/SentCheckPanel";
import { Button } from "@/components/ui/Button";
import { useDataset, useEncryptBill } from "@/data/hooks";
import type { BillDraft } from "@/data/types";
import { plural } from "@/lib/format";
import { networkLabel } from "@/lib/network";
import { isBusy } from "@/lib/tx-machine";
import { useBillOcr, type OcrState } from "@/lib/use-bill-ocr";
import type { BillFormFields } from "@/lib/validate-bill";
import { StepSection } from "./StepSection";

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
        Read the bill. Check every field before you encrypt it.
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

/**
 * Step 2: drop a bill, read it in this browser, review the fields and press Encrypt. The first Encrypt creates
 * the dataset (named in step 1), then records the encrypted bill; later presses only add the bill. The image,
 * the OCR text and the vendor stay in this tab: only amount, date and category reach the DataLayer.
 */
export function EncryptBillStep({
  n,
  datasetId,
  name,
  blockedReason,
  onDatasetCreated,
  onBusyChange,
}: {
  n: number;
  datasetId: string | null;
  name: string;
  /** Set while step 1 is incomplete: Encrypt stays blocked with this reason. */
  blockedReason?: string;
  onDatasetCreated: (id: string) => void;
  /** Lets the page lock the dataset name while the first Encrypt is creating the dataset. */
  onBusyChange?: (busy: boolean) => void;
}) {
  const { state, run, reset } = useEncryptBill(datasetId, { name, onDatasetCreated });
  // Before the dataset exists there is nothing to read; getDataset("") resolves to null in both layers.
  const datasetQuery = useDataset(datasetId ?? "");
  const billCount = datasetId ? (datasetQuery.data?.billCount ?? 0) : 0;
  const { chainId } = useAccount();
  const localMock = networkLabel(chainId) === "Local FHEVM mock";
  const [resetKey, setResetKey] = useState(0);
  const [last, setLast] = useState<{ draft: BillDraft; index: number } | null>(null);
  const [sentCheck, setSentCheck] = useState<SentCheck | null>(null);
  const [prefill, setPrefill] = useState<{ n: number; fields: BillFormFields } | undefined>();
  const ocr = useBillOcr((p) =>
    setPrefill((prev) => ({
      n: (prev?.n ?? 0) + 1,
      fields: { vendor: p.vendor, amount: p.amount, date: p.date, category: p.category },
    })),
  );

  const busy = isBusy(state);
  const confirmed = state.phase === "confirmed";

  function start(input: { draft: BillDraft; index: number }) {
    setLast(input);
    onBusyChange?.(true);
    void run(input).finally(() => onBusyChange?.(false));
  }

  function submit(draft: BillDraft) {
    if (busy || blockedReason) return;
    start({ draft, index: billCount });
  }

  // A failure that carries a hash happened after the bill's transaction was sent (the create, if any, had
  // already confirmed), so it may well have been mined. Sending the bill again would then add it twice, and a
  // dataset cannot lose a bill. So there is no direct "Try again" for it: the seller checks first.
  const sentButUnconfirmed = state.phase === "failed" && state.hash ? state.hash : null;
  const check = sentButUnconfirmed && sentCheck?.hash === sentButUnconfirmed ? sentCheck : null;

  async function checkStatus() {
    if (!last || !sentButUnconfirmed || !datasetId) return;
    const hash = sentButUnconfirmed;
    setSentCheck({ hash, result: "checking" });
    const read = await datasetQuery.refetch();
    const fresh = read.data;
    if (read.isError || !fresh) {
      setSentCheck({ hash, result: "unknown" });
      return;
    }
    // The dataset held `last.index` bills before this one. More than that means the transaction landed.
    setSentCheck({ hash, result: fresh.billCount > last.index ? "added" : "not_added", billCount: fresh.billCount });
  }

  function sendAgain() {
    if (!last || busy) return;
    // The index is recomputed from the dataset as it is now, never reused from the failed attempt.
    start({ draft: last.draft, index: check?.billCount ?? billCount });
  }

  function addAnother() {
    reset();
    setLast(null);
    setSentCheck(null);
    setPrefill(undefined);
    ocr.reset();
    setResetKey((k) => k + 1);
  }

  const total = (last?.index ?? billCount) + 1;

  return (
    <StepSection n={n} id="step-add-bill" title="Add a bill">
      <div className="flex flex-col gap-6">
        <div className="flex items-start gap-3 rounded-lg border border-border bg-bg p-4">
          <LockIcon className="mt-0.5 shrink-0 text-accent-bright" />
          <div className="text-sm">
            <p>
              {localMock
                ? "Local FHEVM mock: the image and the vendor stay in this browser, but this local test node receives the amount, date and category in cleartext. Use a sample bill or made-up values, never a real bill."
                : "The image and the vendor stay in this browser. The amount, date and category are encrypted before they leave it."}
            </p>
            <p className="mt-1 text-muted">
              Local only: the image and these fields stay in your browser until they are encrypted.
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
          <div>
            {confirmed ? (
              <div role="status">
                <p className="text-lg font-semibold">
                  Bill encrypted. This dataset has {plural(total, "bill")}.
                </p>
                <p className="mt-2 text-muted">
                  Your bill was encrypted in this browser and added to the dataset&apos;s encrypted totals. The chain
                  never saw the values.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={addAnother}>
                    Add another bill
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <BillReviewForm
                  onSubmit={submit}
                  busy={busy}
                  resetKey={resetKey}
                  suggestion={prefill}
                  submitLabel="Encrypt"
                  blockedReason={blockedReason}
                />
                {datasetId === null ? (
                  <p className="mt-4 text-sm text-muted">
                    The first Encrypt asks your wallet twice: once to create the dataset, once to record the bill.
                  </p>
                ) : null}
              </>
            )}
            <TxStatus
              state={state}
              onRetry={
                sentButUnconfirmed
                  ? undefined
                  : () => {
                      // Failed before the bill was sent: safe to resend, with the index read fresh. A dataset
                      // created by the failed attempt is kept, so the retry only adds the bill.
                      if (last) start({ draft: last.draft, index: billCount });
                    }
              }
            />
            {sentButUnconfirmed && datasetId ? (
              <SentCheckPanel
                check={check}
                datasetId={datasetId}
                onCheck={() => void checkStatus()}
                onSendAgain={sendAgain}
                onAddAnother={addAnother}
              />
            ) : null}
          </div>
        </div>
      </div>
    </StepSection>
  );
}
