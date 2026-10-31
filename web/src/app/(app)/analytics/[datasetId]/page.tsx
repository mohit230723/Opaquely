"use client";

import { useParams } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { AlertIcon, LockIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { useAnalytics, useMyDatasets, useMyPurchases } from "@/data/hooks";
import { useDataScope } from "@/data/provider";
import type { DatasetAnalytics } from "@/data/types";
import { CATEGORIES } from "@/lib/categories";
import { SEPOLIA_CHAIN_ID } from "@/lib/constants";
import { formatBillAmount, plural } from "@/lib/format";
import { toReadableError } from "@/lib/tx-errors";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card glow className="min-w-0">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-sm text-muted">{label}</p>
        <p className="text-3xl font-semibold leading-tight tabular-nums wrap-break-word">{value}</p>
        {hint ? <p className="text-sm text-muted">{hint}</p> : null}
      </div>
    </Card>
  );
}

function Results({ a }: { a: DatasetAnalytics }) {
  const average = a.billCount > 0 ? a.grandTotalCents / BigInt(a.billCount) : 0n;
  const max = a.categoryTotalsCents.reduce((m, v) => (v > m ? v : m), 0n);
  const rows = CATEGORIES.map((c) => ({ ...c, cents: a.categoryTotalsCents[c.id] ?? 0n })).sort((x, y) =>
    y.cents > x.cents ? 1 : y.cents < x.cents ? -1 : 0,
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total spend" value={formatBillAmount(a.grandTotalCents)} />
        <Stat label="Bills" value={String(a.billCount)} />
        <Stat label="Average bill" value={formatBillAmount(average)} />
        <Stat
          label="Anomalies"
          value={String(a.anomalyCount)}
          hint={`Bills above ${formatBillAmount(a.anomalyThresholdCents)}`}
        />
      </div>

      <Card>
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Spend by category</h2>
          <ul className="flex flex-col gap-3">
            {rows.map((r) => {
              const pct = a.grandTotalCents > 0n ? Number((r.cents * 1000n) / a.grandTotalCents) / 10 : 0;
              const width = max > 0n ? Number((r.cents * 1000n) / max) / 10 : 0;
              return (
                <li key={r.key} className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <span>{r.label}</span>
                    <span className="tabular-nums text-muted">
                      {`${formatBillAmount(r.cents)} · ${pct.toFixed(1)}%`}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-accent to-accent-bright"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </Card>

      <p className="text-sm text-muted">
        Only these aggregate totals were decrypted, for this wallet alone. The individual bills stay encrypted on chain.
      </p>
    </div>
  );
}

/**
 * The decrypted insights of one dataset. The seller and any buyer the contract granted can open it; the totals
 * are decrypted in this browser after one wallet signature, and nobody else can read them.
 */
export default function AnalyticsPage() {
  const params = useParams<{ datasetId: string }>();
  const datasetId = decodeURIComponent(params.datasetId);
  const { chainId } = useDataScope();
  const datasets = useMyDatasets();
  const purchases = useMyPurchases();
  const { query, decrypt } = useAnalytics(datasetId);

  const own = datasets.data?.find((d) => d.id === datasetId);
  const bought = purchases.data?.find((p) => p.datasetId === datasetId);
  const title = own?.name ?? bought?.title ?? `Dataset ${datasetId}`;
  const role = own ? "Your dataset" : bought ? "Bought by you" : null;

  const busy = query.isFetching;
  const error = query.isError ? toReadableError(query.error).reason : null;

  return (
    <PageShell
      title={title}
      subtitle="Encrypted analytics, decrypted only for your wallet."
      actions={role ? <StatusChip variant={own ? "neutral" : "success"}>{role}</StatusChip> : undefined}
    >
      {query.data ? (
        <Results a={query.data} />
      ) : (
        <Card glow>
          <div className="flex flex-col items-start gap-4">
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-accent/20 text-brand-tint">
              <LockIcon width={24} height={24} />
            </span>
            <h2 className="text-xl font-semibold">The totals are still encrypted</h2>
            <p className="max-w-2xl text-muted">
              Spend per category, the grand total, the bill count and the anomaly count are stored on chain as FHE
              ciphertexts. Decrypting asks your wallet for one signature (no transaction, no gas), and only a wallet
              the contract allowed can read them.
            </p>
            {chainId === SEPOLIA_CHAIN_ID ? (
              <p className="text-sm text-muted">On Sepolia the Zama relayer decrypts; this can take up to a minute.</p>
            ) : null}
            {error ? (
              <p role="alert" className="flex items-center gap-2 text-sm text-danger">
                <AlertIcon width={16} height={16} />
                {error}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={decrypt} loading={busy}>
              {busy ? "Decrypting..." : error ? "Try again" : "Decrypt analytics"}
            </Button>
            {own ? <span className="text-sm text-muted">{plural(own.billCount, "bill")} in this dataset</span> : null}
          </div>
        </Card>
      )}
    </PageShell>
  );
}
