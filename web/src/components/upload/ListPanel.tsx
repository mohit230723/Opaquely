"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TxStatus } from "@/components/TxStatus";
import { AlertIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { useDataset, useListDataset } from "@/data/hooks";
import { useDataScope } from "@/data/provider";
import { MIN_BILLS_TO_LIST } from "@/lib/constants";
import { formatEth } from "@/lib/format";
import { categoriesDisclosure } from "@/lib/listing-categories";
import { declaredCategories, useSessionBills } from "@/lib/session-bills";
import { isBusy } from "@/lib/tx-machine";
import { validateListingInput } from "@/lib/validate-listing";
import { StepSection } from "./StepSection";

/** How long the success state stays in the dialog before the page moves to the Marketplace by itself. */
const REDIRECT_MS = 1200;

type Submitted = { title: string; description: string; priceWei: bigint };

/**
 * Step 4: the price and List to Marketplace. The price field is editable from the start (amendment A1); only the
 * List to Marketplace button waits for MIN_BILLS_TO_LIST bills. The dataset name doubles as the listing title and
 * the step-1 description is the listing description. Listing seals the dataset, so it goes through ConfirmDialog
 * with the categories disclosure, and on success the page moves client-side to /marketplace.
 */
export function ListPanel({
  n,
  datasetId,
  name,
  description,
  onDescriptionInvalid,
}: {
  n: number;
  datasetId: string | null;
  name: string;
  description: string;
  /** Called when listing is blocked by the step-1 description, so the page can show its error and focus it. */
  onDescriptionInvalid: () => void;
}) {
  const router = useRouter();
  const id = datasetId ?? "";
  const dataset = useDataset(id);
  const billCount = datasetId ? (dataset.data?.billCount ?? 0) : 0;
  const { state, run, reset } = useListDataset(id);
  const scope = useDataScope();
  // Re-renders when this tab records a bill; the categories are a pure read of that tab memory.
  useSessionBills(scope.address, id);
  const disclosure = categoriesDisclosure(
    scope.source,
    scope.address && datasetId ? declaredCategories(scope.address, datasetId, billCount) : [],
  );

  const [priceEth, setPriceEth] = useState("");
  const [priceTouched, setPriceTouched] = useState(false);
  const [titleError, setTitleError] = useState<string | undefined>();
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState<Submitted | null>(null);
  const priceRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  const busy = isBusy(state);
  const confirmed = state.phase === "confirmed";
  const underMinimum = datasetId === null || billCount < MIN_BILLS_TO_LIST;

  const validation = validateListingInput({ title: name, description, priceEth });
  const priceError = priceTouched && !validation.ok ? validation.errors.price : undefined;

  // Once listed, the page moves to the Marketplace by itself; the button in the dialog goes there at once.
  useEffect(() => {
    if (!confirmed) return;
    const timer = window.setTimeout(() => router.push("/marketplace"), REDIRECT_MS);
    return () => window.clearTimeout(timer);
  }, [confirmed, router]);

  function onList() {
    if (underMinimum || busy) return;
    setPriceTouched(true);
    if (!validation.ok) {
      setTitleError(validation.errors.title);
      if (validation.errors.description) onDescriptionInvalid();
      else if (validation.errors.price) priceRef.current?.focus();
      return;
    }
    setTitleError(undefined);
    setSubmitted(validation.value);
    reset();
    setOpen(true);
  }

  function onConfirm() {
    if (busy || !submitted || !datasetId) return;
    void run(submitted);
  }

  function closeDialog() {
    if (confirmed) {
      router.push("/marketplace");
      return;
    }
    setOpen(false);
    reset();
  }

  return (
    <StepSection n={n} id="step-price" title="Set your price">
      <div className="flex max-w-xl flex-col gap-6">
        <Field
          ref={priceRef}
          label="Price (ETH)"
          name="listing-price"
          inputMode="decimal"
          value={priceEth}
          autoComplete="off"
          suffix="ETH"
          error={priceError}
          helper="Buyers pay this once to get access. Test ETH only."
          onChange={(e) => setPriceEth(e.target.value)}
          onBlur={() => setPriceTouched(true)}
        />
        <div className="flex flex-col items-start gap-3">
          <Button onClick={onList} disabled={underMinimum} aria-describedby={underMinimum ? "list-blocked" : undefined}>
            List to Marketplace
          </Button>
          {underMinimum ? (
            <p id="list-blocked" className="flex items-start gap-2 text-sm text-muted">
              <AlertIcon className="mt-0.5 shrink-0" width={16} height={16} aria-hidden="true" />
              <span>
                Add at least {MIN_BILLS_TO_LIST} bills before listing. This dataset has {billCount}.
              </span>
            </p>
          ) : null}
          {titleError ? (
            <p role="alert" className="text-sm text-danger">
              {titleError}
            </p>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={open}
        title={`List "${submitted?.title ?? name}"?`}
        confirmLabel="List to Marketplace"
        dismissLabel={confirmed ? "Close" : "Keep editing dataset"}
        hideConfirm={confirmed}
        busy={busy}
        onConfirm={onConfirm}
        onDismiss={closeDialog}
        footer={
          <>
            <TxStatus state={state} onRetry={onConfirm} />
            {confirmed && submitted ? (
              <div role="status" className="mt-4">
                <p className="text-base font-semibold">Dataset listed for {formatEth(submitted.priceWei)}.</p>
                <div className="mt-4">
                  <Button href="/marketplace">Go to Marketplace</Button>
                </div>
              </div>
            ) : null}
          </>
        }
      >
        <p>Listing seals this dataset. You will not be able to add or remove bills afterwards.</p>
        <p
          className={`mt-3 ${disclosure.known ? "" : "flex items-start gap-2 text-danger"}`}
          data-testid="categories-disclosure"
        >
          {disclosure.known ? null : <AlertIcon className="mt-0.5 shrink-0" width={18} height={18} aria-hidden="true" />}
          <span>{disclosure.text}</span>
        </p>
        {submitted ? <p className="mt-3 text-muted">Price {formatEth(submitted.priceWei)}</p> : null}
      </ConfirmDialog>
    </StepSection>
  );
}
