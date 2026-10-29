"use client";

import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AsyncBoundary } from "@/components/AsyncBoundary";
import { EmptyState } from "@/components/EmptyState";
import { PageShell } from "@/components/PageShell";
import { Skeleton } from "@/components/Skeleton";
import { TxStatus } from "@/components/TxStatus";
import { AlertIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { useDataset, useListDataset } from "@/data/hooks";
import { useDataScope } from "@/data/provider";
import type { Dataset } from "@/data/types";
import { categoryLabel } from "@/lib/categories";
import { DESCRIPTION_MAX, TITLE_MAX, validateListingInput, type ListingErrors } from "@/lib/validate-listing";
import { MIN_BILLS_TO_LIST } from "@/lib/constants";
import { formatEth, plural } from "@/lib/format";
import { categoriesDisclosure } from "@/lib/listing-categories";
import { declaredCategories, useSessionBills } from "@/lib/session-bills";
import { isBusy } from "@/lib/tx-machine";

type FieldName = "title" | "description" | "price";
type Submitted = { title: string; description: string; priceWei: bigint };

export default function ListDatasetPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const dataset = useDataset(id);
  const { state, run, reset } = useListDataset(id);
  const scope = useDataScope();
  // Re-renders when this tab records a bill; the categories are a pure read of that tab memory.
  useSessionBills(scope.address, id);
  const disclosure = categoriesDisclosure(
    scope.source,
    scope.address ? declaredCategories(scope.address, id, dataset.data?.billCount ?? 0) : [],
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceEth, setPriceEth] = useState("");
  const [touched, setTouched] = useState<Record<FieldName, boolean>>({ title: false, description: false, price: false });
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState<Submitted | null>(null);

  const titleRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const descriptionRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const priceRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  const busy = isBusy(state);
  const confirmed = state.phase === "confirmed";

  const validation = validateListingInput({ title, description, priceEth });
  const allErrors: ListingErrors = validation.ok ? {} : validation.errors;
  const shown: ListingErrors = {
    title: touched.title ? allErrors.title : undefined,
    description: touched.description ? allErrors.description : undefined,
    price: touched.price ? allErrors.price : undefined,
  };
  const touch = (name: FieldName) => setTouched((t) => (t[name] ? t : { ...t, [name]: true }));

  function onList() {
    setTouched({ title: true, description: true, price: true });
    if (!validation.ok) {
      const first = validation.errors.title ? titleRef : validation.errors.description ? descriptionRef : priceRef;
      first.current?.focus();
      return;
    }
    setSubmitted(validation.value);
    reset();
    setOpen(true);
  }

  function onConfirm() {
    if (busy || !submitted) return;
    void run(submitted);
  }

  function closeDialog() {
    setOpen(false);
    if (state.phase !== "confirmed") reset();
  }

  function viewDatasets() {
    setOpen(false);
    router.push("/sell/datasets");
  }

  function renderBody(data: Dataset | null) {
    if (data === null) {
      return (
        <EmptyState heading="Dataset not found" action={{ label: "My datasets", href: "/sell/datasets" }}>
          Check the link or go back to your datasets.
        </EmptyState>
      );
    }
    // While the confirmation dialog is open after the write, keep the form behind it; the listed
    // state shows once the dialog closes.
    if (data.status === "listed" && !open) {
      return (
        <Card className="max-w-xl">
          <p className="text-lg font-semibold">
            Dataset listed for {data.priceWei !== undefined ? formatEth(data.priceWei) : "its price"}.
          </p>
          <p className="mt-1 text-muted wrap-break-word">{data.name}</p>
          <div className="mt-6">
            <Button href="/sell/datasets">View my datasets</Button>
          </div>
        </Card>
      );
    }
    if (data.status === "sealed") {
      return (
        <EmptyState heading="This dataset is sealed" action={{ label: "My datasets", href: "/sell/datasets" }}>
          A sealed dataset cannot be changed.
        </EmptyState>
      );
    }

    const underMinimum = data.billCount < MIN_BILLS_TO_LIST;
    return (
      <div className="flex max-w-2xl flex-col gap-6">
        <Card>
          <p className="text-sm text-muted">Dataset</p>
          <p className="mt-1 text-base font-semibold wrap-break-word">{data.name}</p>
          <p className="mt-2 text-base tabular-nums">{plural(data.billCount, "bill")}</p>
          {data.categories.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Categories">
              {data.categories.map((c) => (
                <li
                  key={c}
                  className="inline-flex h-8 items-center rounded-full border border-border bg-surface-raised px-3 text-sm text-[#a5d8ff]"
                >
                  {categoryLabel(c)}
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        <Card>
          <div className="flex flex-col gap-5">
            <Field
              ref={titleRef}
              label="Title"
              name="listing-title"
              value={title}
              maxLength={TITLE_MAX}
              autoComplete="off"
              disabled={underMinimum}
              error={shown.title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => touch("title")}
            />
            <Field
              ref={descriptionRef}
              label="Description"
              name="listing-description"
              multiline
              rows={4}
              value={description}
              maxLength={DESCRIPTION_MAX}
              disabled={underMinimum}
              error={shown.description}
              helper={`${description.length}/${DESCRIPTION_MAX}`}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => touch("description")}
            />
            <Field
              ref={priceRef}
              label="Price (ETH)"
              name="listing-price"
              inputMode="decimal"
              value={priceEth}
              autoComplete="off"
              suffix="ETH"
              disabled={underMinimum}
              error={shown.price}
              onChange={(e) => setPriceEth(e.target.value)}
              onBlur={() => touch("price")}
            />
          </div>

          {underMinimum ? (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-danger bg-surface-raised p-4">
              <p className="flex items-start gap-2 text-base">
                <AlertIcon className="mt-0.5 shrink-0 text-danger" width={18} height={18} aria-hidden="true" />
                <span>
                  Add at least {MIN_BILLS_TO_LIST} bills before listing. This dataset has {data.billCount}.
                </span>
              </p>
              <Button variant="secondary" href={`/sell/datasets/${data.id}/add`}>
                Add a bill
              </Button>
            </div>
          ) : (
            <div className="mt-6">
              <Button onClick={onList}>List dataset</Button>
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <PageShell title="List dataset">
      <AsyncBoundary query={dataset} thing="dataset" skeleton={<Skeleton className="h-64 w-full max-w-2xl" />}>
        {renderBody}
      </AsyncBoundary>

      <ConfirmDialog
        open={open}
        title={`List "${submitted?.title ?? ""}"?`}
        confirmLabel="Seal and list dataset"
        dismissLabel={confirmed ? "View my datasets" : "Keep editing dataset"}
        hideConfirm={confirmed}
        busy={busy}
        onConfirm={onConfirm}
        onDismiss={confirmed ? viewDatasets : closeDialog}
        footer={<TxStatus state={state} onRetry={onConfirm} />}
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
    </PageShell>
  );
}
