"use client";

import { useQuery } from "@tanstack/react-query";

/** The public model card written by ml/train.py (synthetic training data only, so safe to publish). */
export interface ModelCard {
  generatedAt: string;
  data: string;
  anomaly: {
    model: string;
    nBits: number;
    features: string[];
    trainSize: number;
    testSize: number;
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
    confusion: { tn: number; fp: number; fn: number; tp: number };
    fhe: { samples: number; agreement: number; msPerBill: number };
    amountHistogram: { edgesRupees: number[]; normal: number[]; anomalous: number[] };
    scoreHistogram: { edges: number[]; normal: number[]; anomalous: number[] };
    perCategory: { category: string; bills: number; anomalies: number; flagged: number }[];
  };
  forecast: {
    model: string;
    nBits: number;
    features: string[];
    trainSize: number;
    testSize: number;
    maeRupees: number;
    r2: number;
    fhe: { samples: number; maxAbsDiffRupees: number };
    backtest: { month: number; actual: number; predicted: number }[];
  };
}

export const MODEL_CARD_URL = "/ml/model-card.json";

/** Null when the trainer has not been run yet (the file is created by `docker compose up` in ml/). */
export function useModelCard() {
  return useQuery({
    queryKey: ["model-card"],
    queryFn: async (): Promise<ModelCard | null> => {
      const res = await fetch(MODEL_CARD_URL, { cache: "no-store" });
      if (!res.ok) return null;
      return (await res.json()) as ModelCard;
    },
    staleTime: Infinity,
  });
}

/** Compact rupees for chart axes: ₹950, ₹12.3k, ₹1.2L, ₹3.4Cr. */
export function compactRupees(rupees: number): string {
  const abs = Math.abs(rupees);
  const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, ""));
  if (abs >= 1e7) return `₹${fmt(rupees / 1e7)}Cr`;
  if (abs >= 1e5) return `₹${fmt(rupees / 1e5)}L`;
  if (abs >= 1e3) return `₹${fmt(rupees / 1e3)}k`;
  return `₹${Math.round(rupees)}`;
}

export const centsToRupees = (cents: bigint): number => Number(cents) / 100;

export const percent = (v: number, digits = 1): string => `${(v * 100).toFixed(digits)}%`;
