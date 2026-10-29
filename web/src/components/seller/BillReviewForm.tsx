"use client";

import { useRef, useState, type FocusEvent, type FormEvent, type KeyboardEvent } from "react";
import { AlertIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { ChipGroup } from "@/components/ui/ChipToggle";
import { Field } from "@/components/ui/Field";
import { CATEGORIES } from "@/lib/categories";
import { BILL_CURRENCY_SYMBOL } from "@/lib/constants";
import {
  VENDOR_MAX,
  todayInputValue,
  validateBillDraft,
  type BillFormFields,
} from "@/lib/validate-bill";
import type { BillDraft } from "@/data/types";

export interface BillReviewFormProps {
  onSubmit: (draft: BillDraft) => void;
  /** True while a transaction is in flight: the fields lock and the button shows a spinner. */
  busy?: boolean;
  /** Change this value to clear the form (for example after "Add another bill"). */
  resetKey?: number | string;
  /** Pre-fills the fields (OCR). Read once per mount, so change resetKey together with it. */
  initial?: BillFormFields;
}

type FieldName = keyof BillFormFields;

const EMPTY: BillFormFields = { vendor: "", amount: "", date: "", category: null };

/**
 * Vendor, amount, date and category review form. Phase 4 pre-fills it from OCR; for now it starts
 * empty. Values live in component state only: no storage, no logging, no URL params.
 * The inner form is keyed by resetKey, so changing the key mounts a fresh, empty form.
 */
export function BillReviewForm({ onSubmit, busy = false, resetKey = 0, initial }: BillReviewFormProps) {
  return <ReviewFormBody key={resetKey} onSubmit={onSubmit} busy={busy} initial={initial} />;
}

function ReviewFormBody({ onSubmit, busy, initial }: { onSubmit: (draft: BillDraft) => void; busy: boolean; initial?: BillFormFields }) {
  const [fields, setFields] = useState<BillFormFields>(initial ?? EMPTY);
  // A field's error shows once it has been left (blur) or a submit was attempted; after that it
  // follows the value, so fixing the field clears the message right away.
  const [shown, setShown] = useState<ReadonlySet<FieldName>>(new Set());
  const [today] = useState(() => todayInputValue(new Date()));
  const [mountedAt] = useState(() => new Date());
  const vendorRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const amountRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const dateRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);

  const result = validateBillDraft(fields, mountedAt);
  const errors = result.ok ? {} : result.errors;
  const visible = (name: FieldName) => (shown.has(name) ? errors[name] : undefined);

  function touch(...names: FieldName[]) {
    setShown((prev) => (names.every((n) => prev.has(n)) ? prev : new Set([...prev, ...names])));
  }

  function set<K extends FieldName>(name: K, value: BillFormFields[K]) {
    setFields((prev) => ({ ...prev, [name]: value }));
  }

  function onSubmitForm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    attemptSubmit();
  }

  /** Submits a valid draft; otherwise reveals every error and focuses the first invalid field. */
  function attemptSubmit() {
    if (busy) return;
    const checked = validateBillDraft(fields, new Date());
    if (checked.ok) {
      onSubmit(checked.draft);
      return;
    }
    touch("vendor", "amount", "date", "category");
    const first = (["vendor", "amount", "date"] as const).find((n) => checked.errors[n]);
    const target = first === "vendor" ? vendorRef : first === "amount" ? amountRef : first === "date" ? dateRef : null;
    if (target) target.current?.focus();
    else categoryRef.current?.querySelector<HTMLButtonElement>('[role="radio"]')?.focus();
  }

  // The submit button is aria-disabled while the draft is invalid (UI-SPEC), and Button blocks its
  // click, which is also what Enter in a text field synthesizes. So an Enter on an incomplete form
  // would do nothing. Handle it here so it shows the errors and focuses the first invalid field.
  function onFormKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key !== "Enter" || e.nativeEvent.isComposing || result.ok) return;
    if (!(e.target instanceof HTMLInputElement)) return;
    e.preventDefault();
    attemptSubmit();
  }

  function onCategoryBlur(e: FocusEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget)) touch("category");
  }

  const categoryError = visible("category");

  return (
    <form onSubmit={onSubmitForm} onKeyDown={onFormKeyDown} noValidate aria-label="Bill details" className="flex flex-col gap-6">
      <Field
        ref={vendorRef}
        label="Vendor (optional)"
        name="vendor"
        value={fields.vendor}
        maxLength={VENDOR_MAX}
        autoComplete="off"
        readOnly={busy}
        error={visible("vendor")}
        helper="Stays on this device. Never sent to the chain."
        onChange={(e) => set("vendor", e.target.value)}
        onBlur={() => touch("vendor")}
      />
      <Field
        ref={amountRef}
        label="Total amount"
        name="amount"
        value={fields.amount}
        inputMode="decimal"
        autoComplete="off"
        prefix={BILL_CURRENCY_SYMBOL}
        readOnly={busy}
        error={visible("amount")}
        onChange={(e) => set("amount", e.target.value)}
        onBlur={() => touch("amount")}
      />
      <Field
        ref={dateRef}
        label="Date"
        name="date"
        type="date"
        value={fields.date}
        max={today}
        readOnly={busy}
        error={visible("date")}
        onChange={(e) => set("date", e.target.value)}
        onBlur={() => touch("date")}
      />
      <div ref={categoryRef} onBlur={onCategoryBlur}>
        <p id="bill-category-label" className="mb-2 text-sm font-semibold">
          Category
        </p>
        <ChipGroup
          mode="radio"
          label="Category"
          className="grid! grid-cols-2 sm:grid-cols-3"
          options={CATEGORIES.map((c) => ({ value: c.id, label: c.label }))}
          value={fields.category ?? undefined}
          onChange={(next) => {
            if (busy) return;
            set("category", next);
          }}
        />
        {categoryError ? (
          <p className="mt-2 flex items-start gap-2 text-sm text-danger">
            <AlertIcon className="mt-0.5 shrink-0" width={16} height={16} />
            <span>{categoryError}</span>
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="submit" loading={busy} disabled={!result.ok}>
          Add bill to dataset
        </Button>
        {!result.ok ? <p className="text-sm text-muted">Enter an amount, a date and a category to continue.</p> : null}
      </div>
    </form>
  );
}
