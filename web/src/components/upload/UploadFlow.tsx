"use client";

import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AsyncBoundary } from "@/components/AsyncBoundary";
import { EmptyState } from "@/components/EmptyState";
import { PageShell } from "@/components/PageShell";
import { Skeleton } from "@/components/Skeleton";
import { useDataset } from "@/data/hooks";
import { useDataScope } from "@/data/provider";
import type { Dataset } from "@/data/types";
import { validDatasetDescription, validDatasetName } from "@/lib/validate-dataset";
import { DescribeStep } from "./DescribeStep";
import { EncryptBillStep } from "./EncryptBillStep";
import { EncryptedBills } from "./EncryptedBills";
import { ListPanel } from "./ListPanel";

const DESCRIBE_FIRST = "Add a name and description first.";

/** A draft the seller is resuming: its id and on-chain name. The description is not stored on-chain. */
type Draft = { id: string; name: string };

/**
 * The one-page Upload flow (D-03): describe the dataset, add bills with Encrypt, see them encrypted, then set a
 * price and list. A new dataset is created by the first Encrypt. `/upload?dataset={id}` resumes an owned open
 * draft instead. Every step stays on this page and every link is client-side: a hard reload would wipe the
 * tab-memory bill fields.
 */
export function UploadFlow() {
  const resumeId = useSearchParams().get("dataset");
  return (
    <PageShell title="Upload" subtitle="Turn your bills into an encrypted dataset you can sell.">
      {resumeId === null ? <UploadSteps key="new" draft={null} /> : <ResumeDraft key={resumeId} id={resumeId} />}
    </PageShell>
  );
}

function isResumable(data: Dataset | null | undefined, address: string | undefined): data is Dataset {
  return Boolean(
    data && address && data.status === "open" && data.owner.toLowerCase() === address.toLowerCase(),
  );
}

/**
 * Resume from a link. The id is untrusted: it is only passed to useDataset, which returns null unless this wallet
 * owns the dataset, and it is never rendered or used to build a URL. Anything but an owned open draft is
 * "Dataset not found". Once accepted, the draft stays accepted for this visit, so the steps do not unmount when
 * listing turns the dataset from open to listed just before the move to the Marketplace.
 */
function ResumeDraft({ id }: { id: string }) {
  const query = useDataset(id);
  const { address } = useDataScope();
  const [accepted, setAccepted] = useState<Draft | null>(null);
  const data = query.data;
  if (accepted === null && isResumable(data, address)) {
    setAccepted({ id: data.id, name: data.name });
  }

  if (accepted) return <UploadSteps draft={accepted} />;
  return (
    <AsyncBoundary query={query} thing="dataset" skeleton={<Skeleton className="h-64 w-full" />}>
      {(found) =>
        isResumable(found, address) ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <EmptyState heading="Dataset not found" action={{ label: "Upload", href: "/upload" }}>
            This link does not point to one of your open datasets. Start a new dataset instead.
          </EmptyState>
        )
      }
    </AsyncBoundary>
  );
}

function UploadSteps({ draft }: { draft: Draft | null }) {
  const [datasetId, setDatasetId] = useState<string | null>(draft?.id ?? null);
  const [name, setName] = useState(draft?.name ?? "");
  const [description, setDescription] = useState("");
  const [encrypting, setEncrypting] = useState(false);
  const [listAttempted, setListAttempted] = useState(false);
  const descriptionRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  const describeOk = validDatasetName(name) && validDatasetDescription(description);
  // Step 1 must be complete before the first Encrypt creates the dataset. Once it exists, bills can be added
  // straight away (a resumed draft starts with an empty description); the description is checked when listing.
  const blockedReason = datasetId !== null || describeOk ? undefined : DESCRIBE_FIRST;

  return (
    <div className="flex flex-col gap-10">
      <DescribeStep
        n={1}
        name={name}
        description={description}
        onNameChange={setName}
        onDescriptionChange={setDescription}
        nameLocked={datasetId !== null || encrypting}
        descriptionRef={descriptionRef}
        showDescriptionError={listAttempted}
      />
      <EncryptBillStep
        n={2}
        datasetId={datasetId}
        name={name}
        blockedReason={blockedReason}
        onDatasetCreated={setDatasetId}
        onBusyChange={setEncrypting}
      />
      <EncryptedBills n={3} datasetId={datasetId} />
      <ListPanel
        n={4}
        datasetId={datasetId}
        name={name}
        description={description}
        onDescriptionInvalid={() => {
          setListAttempted(true);
          descriptionRef.current?.focus();
        }}
      />
    </div>
  );
}
