import { DESCRIPTION_MAX } from "./validate-listing";

/** Dataset name rules, shared by the Upload page (moved from the interim create form, unchanged). */
export const NAME_MAX = 60;
export const NAME_ERROR = "Give your dataset a name (1 to 60 characters).";

/** 1 to 60 characters after trimming. */
export function validDatasetName(value: string): boolean {
  const n = value.trim().length;
  return n >= 1 && n <= NAME_MAX;
}

/** 1 to 300 characters after trimming: the listing rule, so the description can later be listed as typed. */
export function validDatasetDescription(value: string): boolean {
  const n = value.trim().length;
  return n >= 1 && n <= DESCRIPTION_MAX;
}
