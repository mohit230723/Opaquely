"use client";

// The seller-side Concrete ML helper (ml/helper.py, `docker compose up` in ml/). It runs on the seller's own
// machine, so the bills posted here never leave it; the helper sends only ciphertexts to the FHE server.
import type { BillFields, MlInsights } from "@/data/types";

export const ML_HELPER_URL = process.env.NEXT_PUBLIC_ML_HELPER_URL ?? "http://127.0.0.1:8765";

export const HELPER_DOWN_REASON =
  "The ML helper is not running. Start it with `docker compose up` in the ml folder, then try again.";

/** What one run reports about the encrypted round trip (for the seller's screen only). */
export interface MlTrace {
  bills: number;
  bytesSent: number;
  bytesReceived: number;
  seconds: number;
  ciphertextPreview: string;
}

export interface MlRun {
  insights: MlInsights;
  /** Per-bill anomaly probabilities. Shown to the seller only; never stored on-chain. */
  scores: number[];
  trace: MlTrace;
}

interface HelperResponse {
  monthStart: number;
  monthTotalsCents: string[];
  forecastCents: string;
  mlAnomalyCount: number;
  scoreBuckets: number[];
  scores: number[];
  trace: MlTrace;
}

export async function helperHealthy(): Promise<{ helper: boolean; server: boolean }> {
  try {
    const res = await fetch(`${ML_HELPER_URL}/health`, { cache: "no-store" });
    if (!res.ok) return { helper: false, server: false };
    const body = (await res.json()) as { server?: boolean };
    return { helper: true, server: Boolean(body.server) };
  } catch {
    return { helper: false, server: false };
  }
}

export async function runEncryptedMl(bills: readonly BillFields[]): Promise<MlRun> {
  let res: Response;
  try {
    res = await fetch(`${ML_HELPER_URL}/insights`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bills: bills.map((b) => ({ amountCents: Number(b.amountCents), category: b.category, dateDays: b.dateDays })),
      }),
    });
  } catch {
    throw new Error(HELPER_DOWN_REASON);
  }
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(
      typeof detail?.detail === "string" ? detail.detail : `The ML helper failed (HTTP ${res.status}).`,
    );
  }
  const body = (await res.json()) as HelperResponse;
  return {
    insights: {
      monthStart: body.monthStart - 1, // the helper sends months since January 1970 plus one
      monthTotalsCents: body.monthTotalsCents.map((v) => BigInt(v)),
      forecastCents: BigInt(body.forecastCents),
      mlAnomalyCount: body.mlAnomalyCount,
      scoreBuckets: body.scoreBuckets,
    },
    scores: body.scores,
    trace: body.trace,
  };
}

/** "Oct 2026" from months since January 1970. */
export function monthLabel(monthIndex: number): string {
  const d = new Date(Date.UTC(1970 + Math.floor(monthIndex / 12), monthIndex % 12, 1));
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}
