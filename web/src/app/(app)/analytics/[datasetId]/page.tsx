"use client";

import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import {
  AnomalySection,
  HeadlineStats,
  ModelCardSection,
  RunMlPanel,
  SpendSection,
  TrendSection,
} from "@/components/analytics/Dashboard";
import { AlertIcon, LockIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { useAnalytics, useMyDatasets, useMyPurchases } from "@/data/hooks";
import { useDataScope } from "@/data/provider";
import { SEPOLIA_CHAIN_ID } from "@/lib/constants";
import { plural } from "@/lib/format";
import type { MlRun } from "@/lib/ml-helper";
import { toReadableError } from "@/lib/tx-errors";

/**
 * The dataset dashboard. The seller and any buyer the contract granted decrypt the aggregate totals and the
 * Concrete ML insights in this browser after one wallet signature; the public model card shows how the
 * models were trained. The seller also runs the encrypted models from here.
 */
export default function AnalyticsPage() {
  const params = useParams<{ datasetId: string }>();
  const datasetId = decodeURIComponent(params.datasetId);
  const { chainId } = useDataScope();
  const datasets = useMyDatasets();
  const purchases = useMyPurchases();
  const { query, decrypt } = useAnalytics(datasetId);
  const [run, setRun] = useState<MlRun | null>(null);
  const onRun = useCallback((r: MlRun | null) => setRun(r), []);

  const own = datasets.data?.find((d) => d.id === datasetId);
  const bought = purchases.data?.find((p) => p.datasetId === datasetId);
  const title = own?.name ?? bought?.title ?? `Dataset ${datasetId}`;
  const role = own ? "Your dataset" : bought ? "Bought by you" : null;

  const busy = query.isFetching;
  const error = query.isError ? toReadableError(query.error).reason : null;
  const a = query.data;

  return (
    <PageShell
      title={title}
      subtitle="Encrypted analytics and machine learning, decrypted only for your wallet."
      actions={role ? <StatusChip variant={own ? "neutral" : "success"}>{role}</StatusChip> : undefined}
    >
      <div className="flex flex-col gap-16">
        {a ? (
          <>
            <HeadlineStats a={a} />
            <SpendSection a={a} />
            <TrendSection a={a} sellerPanel={own ? <RunMlPanel datasetId={datasetId} onRun={onRun} /> : undefined} />
            <AnomalySection a={a} run={run} />
            <p className="text-sm text-muted">
              Only aggregate totals and model results were decrypted, for this wallet alone. The individual bills stay
              encrypted on chain.
            </p>
          </>
        ) : (
          <Card glow>
            <div className="flex flex-col items-start gap-4">
              <span className="inline-flex size-12 items-center justify-center rounded-full bg-accent/20 text-brand-tint">
                <LockIcon width={24} height={24} />
              </span>
              <h2 className="text-xl font-semibold">The insights are still encrypted</h2>
              <p className="max-w-2xl text-muted">
                Spend per category, monthly totals, the ML forecast and the anomaly scores are stored on chain as FHE
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
        <ModelCardSection />
      </div>
    </PageShell>
  );
}
