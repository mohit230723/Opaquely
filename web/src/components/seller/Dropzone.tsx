"use client";

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { AlertIcon, UploadIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { checkBillImage } from "@/lib/file-check";

interface Preview {
  url: string;
  name: string;
}

/** Synthetic bills bundled in public/samples (no real data), for demos and as the OCR e2e inputs. */
export const SAMPLE_BILLS = [
  { url: "/samples/bill-grocery.png", label: "Grocery" },
  { url: "/samples/bill-electricity.png", label: "Electricity" },
  { url: "/samples/bill-pharmacy.png", label: "Pharmacy" },
] as const;

/**
 * Optional bill photo: pick or drop a JPG or PNG and see it in this tab. The File and its blob: URL
 * live only in component state. No storage, no FormData, no network, no logging. Remount it with a
 * new `key` to clear the image.
 */
export function Dropzone({ onImageChange }: { onImageChange?: (url: string | null) => void }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const url = preview?.url ?? null;

  // Revokes the URL when it is replaced, removed or the dropzone unmounts. No setState in here.
  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  function accept(file: File | undefined) {
    if (!file) return;
    const check = checkBillImage(file);
    if (!check.ok) {
      // A bad file never touches the current preview.
      setError(check.error);
      return;
    }
    setError(null);
    const url = URL.createObjectURL(file);
    setPreview({ url, name: file.name });
    onImageChange?.(url);
  }

  function pickSample(sample: (typeof SAMPLE_BILLS)[number]) {
    setError(null);
    setPreview({ url: sample.url, name: `${sample.label} sample bill` });
    onImageChange?.(sample.url);
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    accept(e.target.files?.[0]);
    e.target.value = ""; // lets the same file be chosen again
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    accept(e.dataTransfer.files?.[0]);
  }

  return (
    <div>
      <div
        role="group"
        aria-label="Bill image"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex min-h-48 flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-6 text-center ${
          dragging ? "border-[#38bdf8]" : "border-[#5b6fb0]"
        }`}
      >
        <UploadIcon width={32} height={32} className="text-accent-bright" />
        <p className="text-base">Drop a JPG or PNG here, or choose a file</p>
        <Button variant="secondary" onClick={() => input.current?.click()}>
          Choose file
        </Button>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg"
          aria-label="Bill image file"
          className="sr-only"
          tabIndex={-1}
          onChange={onPick}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">Or try a sample bill:</span>
        {SAMPLE_BILLS.map((sample) => (
          <Button key={sample.url} variant="secondary" onClick={() => pickSample(sample)}>
            {sample.label}
          </Button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-danger">
          <AlertIcon className="mt-0.5 shrink-0" width={16} height={16} />
          <span>{error}</span>
        </p>
      ) : null}
      {preview ? (
        <div className="mt-4">
          {/* A blob: URL cannot go through next/image, and nothing here is optimized or uploaded. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview.url}
            alt="Preview of the selected bill"
            className="max-h-80 w-full rounded-lg border border-border object-contain"
          />
          <p className="mt-2 text-sm text-muted wrap-break-word">{preview.name}. Stays in this browser tab. It is never uploaded.</p>
          <Button
            variant="ghost"
            className="mt-2"
            onClick={() => {
              setPreview(null);
              setError(null);
              onImageChange?.(null);
            }}
          >
            Remove image
          </Button>
        </div>
      ) : null}
    </div>
  );
}
