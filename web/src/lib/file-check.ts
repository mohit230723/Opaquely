import { MAX_UPLOAD_BYTES } from "./constants";

export const TYPE_ERROR = "Only JPG or PNG images are supported. Choose a different file.";
export const SIZE_ERROR = "That image is larger than 10 MB. Choose a smaller file.";

const ACCEPTED_TYPES = ["image/png", "image/jpeg"];

export type FileCheck = { ok: true } | { ok: false; error: string };

/** MIME and size rule for a bill image. The type is checked first, then the size. */
export function checkBillImage(file: { type: string; size: number }): FileCheck {
  if (!ACCEPTED_TYPES.includes(file.type)) return { ok: false, error: TYPE_ERROR };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: SIZE_ERROR };
  return { ok: true };
}
