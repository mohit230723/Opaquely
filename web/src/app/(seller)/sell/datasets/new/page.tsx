"use client";

import { useRef, useState, type FormEvent } from "react";
import { useCreateDataset } from "@/data/hooks";
import { PageShell } from "@/components/PageShell";
import { TxStatus } from "@/components/TxStatus";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { isBusy } from "@/lib/tx-machine";

const NAME_ERROR = "Give your dataset a name (1 to 60 characters).";

function validName(value: string): boolean {
  const n = value.trim().length;
  return n >= 1 && n <= 60;
}

export default function NewDatasetPage() {
  const { state, run } = useCreateDataset();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [submitted, setSubmitted] = useState<{ name: string } | null>(null);
  const nameRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  const busy = isBusy(state);
  const created = state.phase === "confirmed" ? state.receipt.createdId : undefined;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    if (!validName(name)) {
      setError(NAME_ERROR);
      nameRef.current?.focus();
      return;
    }
    setError(undefined);
    const input = { name: name.trim() };
    setSubmitted(input);
    void run(input);
  }

  function onRetry() {
    if (submitted) void run(submitted);
  }

  return (
    <PageShell title="New dataset">
      <Card className="max-w-xl">
        {state.phase === "confirmed" ? (
          <div>
            <p className="text-lg font-semibold">Dataset created.</p>
            <p className="mt-1 text-muted wrap-break-word">{submitted?.name}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button href={`/sell/datasets/${created ?? ""}/add`}>Add your first bill</Button>
              <Button variant="secondary" href="/sell/datasets">
                Back to datasets
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <Field
              ref={nameRef}
              label="Dataset name"
              name="dataset-name"
              value={name}
              maxLength={60}
              autoComplete="off"
              readOnly={busy}
              error={error}
              helper="A group of bills you will sell together. 1 to 60 characters."
              onChange={(e) => {
                setName(e.target.value);
                if (error && validName(e.target.value)) setError(undefined);
              }}
              onBlur={() => setError(validName(name) ? undefined : NAME_ERROR)}
            />
            <div className="mt-6">
              <Button type="submit" loading={busy}>
                Create dataset
              </Button>
            </div>
          </form>
        )}
        <TxStatus state={state} onRetry={onRetry} />
      </Card>
    </PageShell>
  );
}
