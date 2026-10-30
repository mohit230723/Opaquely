"use client";

import { useState } from "react";
import { Field } from "@/components/ui/Field";
import { DESCRIPTION_ERROR, DESCRIPTION_MAX } from "@/lib/validate-listing";
import { NAME_ERROR, NAME_MAX, validDatasetDescription, validDatasetName } from "@/lib/validate-dataset";
import { StepSection } from "./StepSection";

/**
 * Step 1: the dataset name and description. The name is the dataset name on-chain and later the listing title;
 * it becomes read-only once the dataset exists. Errors show once a field has been left with an invalid value.
 */
export function DescribeStep({
  n,
  name,
  description,
  onNameChange,
  onDescriptionChange,
  nameLocked,
}: {
  n: number;
  name: string;
  description: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  /** True once the dataset exists (or while the first Encrypt is creating it). */
  nameLocked: boolean;
}) {
  const [nameLeft, setNameLeft] = useState(false);
  const [descriptionLeft, setDescriptionLeft] = useState(false);
  const nameError = nameLeft && !validDatasetName(name) ? NAME_ERROR : undefined;
  const descriptionError = descriptionLeft && !validDatasetDescription(description) ? DESCRIPTION_ERROR : undefined;

  return (
    <StepSection n={n} id="step-describe" title="Describe your dataset">
      <div className="flex flex-col gap-6">
        <Field
          label="Dataset name"
          name="dataset-name"
          value={name}
          maxLength={NAME_MAX}
          autoComplete="off"
          readOnly={nameLocked}
          error={nameError}
          helper={
            nameLocked
              ? "The dataset exists, so its name is fixed."
              : "A short name buyers will see. 1 to 60 characters."
          }
          onChange={(e) => onNameChange(e.target.value)}
          onBlur={() => setNameLeft(true)}
        />
        <Field
          label="Description"
          name="dataset-description"
          multiline
          rows={3}
          value={description}
          maxLength={DESCRIPTION_MAX}
          error={descriptionError}
          helper={
            <>
              What these bills cover, in a sentence or two. 1 to 300 characters.{" "}
              <span className="tabular-nums">
                {description.length}/{DESCRIPTION_MAX}
              </span>
            </>
          }
          onChange={(e) => onDescriptionChange(e.target.value)}
          onBlur={() => setDescriptionLeft(true)}
        />
      </div>
    </StepSection>
  );
}
