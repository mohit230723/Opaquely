"use client";

import { useAccount } from "wagmi";
import { useMyDatasets } from "@/data/hooks";

export default function SellerHomePage() {
  const { address } = useAccount();
  const datasets = useMyDatasets();

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
      <h1 className="text-2xl font-semibold leading-tight">Seller dashboard</h1>
      <div className="mt-8">
        {!address ? (
          <p className="text-muted">Connect your wallet to continue.</p>
        ) : datasets.isPending ? (
          <div aria-busy="true">
            <span className="sr-only">Loading datasets</span>
            <p className="text-muted">Loading datasets</p>
          </div>
        ) : datasets.isError ? (
          <div role="alert" className="rounded-xl border border-danger p-6">
            <h2 className="text-base font-semibold">Could not load datasets</h2>
            <p className="mt-2 text-muted">Something went wrong while reading data. Try again.</p>
            <button
              type="button"
              onClick={() => void datasets.refetch()}
              className="mt-4 h-11 rounded-lg border border-border-strong px-4 font-semibold"
            >
              Try again
            </button>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {datasets.data.map((d) => (
              <li key={d.id} className="rounded-xl border border-border bg-surface p-6">
                <p className="text-base font-semibold">{d.name}</p>
                <p className="text-sm text-muted">
                  {d.billCount} {d.billCount === 1 ? "bill" : "bills"} · {d.status}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
