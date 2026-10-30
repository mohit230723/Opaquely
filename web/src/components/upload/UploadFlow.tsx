"use client";

import { useRef, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { validDatasetDescription, validDatasetName } from "@/lib/validate-dataset";
import { DescribeStep } from "./DescribeStep";
import { EncryptBillStep } from "./EncryptBillStep";
import { ListPanel } from "./ListPanel";

const DESCRIBE_FIRST = "Add a name and description first.";

/**
 * The one-page Upload flow (D-03): describe the dataset, then add bills with Encrypt. The dataset is created by
 * the first Encrypt, so `datasetId` starts null and is set once that create is confirmed. Every step stays on
 * this page and every link is client-side: a hard reload would wipe the tab-memory bill fields.
 */
export function UploadFlow() {
  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [encrypting, setEncrypting] = useState(false);
  const [listAttempted, setListAttempted] = useState(false);
  const descriptionRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  const describeOk = validDatasetName(name) && validDatasetDescription(description);

  return (
    <PageShell title="Upload" subtitle="Turn your bills into an encrypted dataset you can sell.">
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
          blockedReason={describeOk ? undefined : DESCRIBE_FIRST}
          onDatasetCreated={setDatasetId}
          onBusyChange={setEncrypting}
        />
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
    </PageShell>
  );
}
