"use client";

import { LockIcon } from "@/components/icons";
import { useDataset } from "@/data/hooks";
import { MIN_BILLS_TO_LIST } from "@/lib/constants";
import { DatasetChainView } from "./ChainRows";
import { StepSection } from "./StepSection";

/**
 * Step 3: the bills already encrypted into this dataset, as the chain stores them (handles) beside what this
 * browser still holds. Quiet, with no controls, until the first Encrypt has created the dataset.
 */
export function EncryptedBills({ n, datasetId }: { n: number; datasetId: string | null }) {
  const dataset = useDataset(datasetId ?? "");
  const billCount = datasetId ? (dataset.data?.billCount ?? 0) : 0;

  return (
    <StepSection n={n} id="step-encrypted-bills" title="Encrypted bills" quiet={datasetId === null}>
      <div className="flex flex-col gap-4">
        {billCount < MIN_BILLS_TO_LIST ? (
          <p className="text-sm text-muted tabular-nums">
            {billCount} of {MIN_BILLS_TO_LIST} bills needed to list
          </p>
        ) : null}
        <p className="flex items-start gap-3 text-sm text-muted">
          <LockIcon className="mt-0.5 shrink-0 text-accent-bright" aria-hidden="true" />
          <span>
            The chain stores encrypted handles. A handle is a reference to a ciphertext, and the value cannot be read
            from it.
          </span>
        </p>
        {datasetId === null ? (
          <p className="text-muted">Bills you encrypt appear here, next to what the chain stores for them.</p>
        ) : (
          <DatasetChainView datasetId={datasetId} />
        )}
      </div>
    </StepSection>
  );
}
