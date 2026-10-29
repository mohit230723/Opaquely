"use client";

// Browser OCR. This is the only file that imports tesseract.js (use-bill-ocr.ts calls it). Every
// asset is same-origin under /tesseract, so OCR works with the CDN blocked, and the image is never
// sent anywhere: the worker runs in this tab and gets the pixels through postMessage.
import type { Worker as TesseractWorker } from "tesseract.js";

const BASE = "/tesseract";
/** Longest side the image is scaled to: bigger photos are shrunk, tiny ones enlarged. */
export const OCR_MAX_SIDE = 2000;
export const OCR_MIN_SIDE = 1200;

export interface OcrProgress {
  status: string;
  /** 0 to 1 within the current stage. Only "recognizing text" is a meaningful overall bar. */
  progress: number;
}

let workerPromise: Promise<TesseractWorker> | null = null;
let listener: ((p: OcrProgress) => void) | null = null;

function getWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    const created = (async () => {
      const mod = await import("tesseract.js");
      const createWorker = mod.createWorker ?? mod.default.createWorker;
      // OEM 1 = LSTM only: loads the three *-lstm.wasm.js cores and the 2.9 MB best_int model.
      return createWorker("eng", 1, {
        workerPath: `${BASE}/worker.min.js`,
        corePath: BASE, // a directory: the worker picks relaxedsimd, simd or plain by feature detection
        langPath: `${BASE}/lang`,
        // "none" skips the IndexedDB model cache (idb-keyval) that tesseract writes by default.
        cacheMethod: "none",
        logger: (m) => listener?.({ status: m.status, progress: m.progress }),
      });
    })();
    created.catch(() => {
      if (workerPromise === created) workerPromise = null; // never cache a failed init
    });
    workerPromise = created;
  }
  return workerPromise;
}

/** Start loading the engine (about 0.4 s warm, a few seconds cold) so the first read is quick. */
export function prewarmOcr(): void {
  void getWorker().catch(() => {
    // The real error surfaces when the seller actually runs OCR; manual entry still works.
  });
}

export async function terminateOcr(): Promise<void> {
  const current = workerPromise;
  workerPromise = null;
  listener = null;
  if (current) await current.then((w) => w.terminate()).catch(() => undefined);
}

/** Decode, scale to OCR_MIN_SIDE..OCR_MAX_SIDE and convert to grayscale on a canvas. */
export async function preprocessImage(url: string): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const longest = Math.max(img.naturalWidth, img.naturalHeight);
  const target = longest > OCR_MAX_SIDE ? OCR_MAX_SIDE : longest < OCR_MIN_SIDE ? OCR_MIN_SIDE : longest;
  const scale = target / longest;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  // Manual luma instead of ctx.filter, which Safari does not support.
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const y = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
    px[i] = px[i + 1] = px[i + 2] = y;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

/** Runs OCR on an image URL (a blob: URL or a same-origin sample) and returns the raw text. */
export async function recognizeBill(url: string, onProgress: (p: OcrProgress) => void): Promise<string> {
  listener = onProgress;
  try {
    const [worker, canvas] = await Promise.all([getWorker(), preprocessImage(url)]);
    const { data } = await worker.recognize(canvas);
    return data.text;
  } finally {
    listener = null;
  }
}
