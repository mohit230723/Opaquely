"use client";

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { AlertIcon, UploadIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { checkBillImage } from "@/lib/file-check";

interface Preview {
  url: string;
  name: string;
}

/**
 * Optional bill photo: pick or drop a JPG or PNG and see it in this tab. The File and its blob: URL
 * live only in component state. No storage, no FormData, no network, no logging. Remount it with a
 * new `key` to clear the image.
 */
export function Dropzone() {
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
    setPreview({ url: URL.createObjectURL(file), name: file.name });
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
            }}
          >
            Remove image
          </Button>
        </div>
      ) : null}
    </div>
  );
}
