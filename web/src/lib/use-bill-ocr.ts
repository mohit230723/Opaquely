"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { prewarmOcr, recognizeBill, terminateOcr } from "./ocr";
import { parseReceiptText, type ParsedReceipt } from "./parse-receipt";
import { todayInputValue } from "./validate-bill";

export type OcrState =
  | { phase: "idle" }
  | { phase: "running"; status: string; progress: number }
  | { phase: "done" }
  | { phase: "failed"; reason: string };

export const OCR_FAILED_REASON = "Could not read this bill. Enter the details by hand.";

/**
 * Reads one bill image in the browser and reports the parsed fields through onParsed. Warms the
 * engine on mount and terminates it on unmount. A newer run (or a reset) makes an older one's result
 * and progress get dropped. The text itself is never kept: only the parsed suggestion leaves here.
 */
export function useBillOcr(onParsed: (parsed: ParsedReceipt) => void) {
  const [state, setState] = useState<OcrState>({ phase: "idle" });
  const runRef = useRef(0);
  const onParsedRef = useRef(onParsed);

  useEffect(() => {
    onParsedRef.current = onParsed;
  });

  useEffect(() => {
    prewarmOcr();
    return () => {
      runRef.current += 1;
      void terminateOcr();
    };
  }, []);

  const run = useCallback(async (url: string) => {
    const id = ++runRef.current;
    setState({ phase: "running", status: "loading", progress: 0 });
    try {
      const text = await recognizeBill(url, (p) => {
        if (runRef.current === id) setState({ phase: "running", status: p.status, progress: p.progress });
      });
      if (runRef.current !== id) return;
      onParsedRef.current(parseReceiptText(text, todayInputValue(new Date())));
      setState({ phase: "done" });
    } catch {
      if (runRef.current === id) setState({ phase: "failed", reason: OCR_FAILED_REASON });
    }
  }, []);

  const reset = useCallback(() => {
    runRef.current += 1;
    setState({ phase: "idle" });
  }, []);

  return { state, run, reset };
}
