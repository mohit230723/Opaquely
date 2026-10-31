"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BarList, ChartFrame, ColumnChart, LineChart, MatrixChart, SERIES_COLORS } from "@/components/charts/Charts";
import { AlertIcon, CheckIcon, LockIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useRunMl, type MlStep } from "@/data/hooks";
import type { DatasetAnalytics } from "@/data/types";
import { CATEGORIES } from "@/lib/categories";
import { formatBillAmount } from "@/lib/format";
import { helperHealthy, monthLabel, type MlRun } from "@/lib/ml-helper";
import { centsToRupees, compactRupees, percent, useModelCard, type ModelCard } from "@/lib/model-card";

const SCORE_BANDS = ["0–0.2", "0.2–0.4", "0.4–0.6", "0.6–0.8", "0.8–1"];

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
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

function Section({ id, eyebrow, title, lede, children }: { id: string; eyebrow: string; title: string; lede: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-tint">{eyebrow}</p>
        <h2 id={id} className="text-2xl font-semibold">
          {title}
        </h2>
        <p className="max-w-3xl text-muted">{lede}</p>
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <Card>
      <div className="flex items-start gap-3 text-muted">
        <LockIcon width={20} height={20} className="mt-0.5 shrink-0" />
        <div className="flex flex-col gap-2">{children}</div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- headline numbers

export function HeadlineStats({ a }: { a: DatasetAnalytics }) {
  const average = a.billCount > 0 ? a.grandTotalCents / BigInt(a.billCount) : 0n;
  const ins = a.insights;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Stat label="Total spend" value={formatBillAmount(a.grandTotalCents)} />
      <Stat label="Bills" value={String(a.billCount)} />
      <Stat label="Average bill" value={formatBillAmount(average)} />
      <Stat label="Rule anomalies" value={String(a.anomalyCount)} hint={`Above ${formatBillAmount(a.anomalyThresholdCents)}`} />
      <Stat label="ML anomalies" value={ins ? String(ins.mlAnomalyCount) : "—"} hint={ins ? "Model score ≥ 0.5" : "Run encrypted ML"} />
      <Stat
        label="Forecast next month"
        value={ins ? formatBillAmount(ins.forecastCents) : "—"}
        hint={ins ? monthLabel(ins.monthStart + 6) : "Run encrypted ML"}
      />
    </div>
  );
}

// ---------------------------------------------------------------- 01 spend breakdown

export function SpendSection({ a }: { a: DatasetAnalytics }) {
  const rows = CATEGORIES.map((c) => ({ label: c.label, cents: a.categoryTotalsCents[c.id] ?? 0n })).sort((x, y) =>
    y.cents > x.cents ? 1 : y.cents < x.cents ? -1 : 0,
  );
  const share = (cents: bigint) => (a.grandTotalCents > 0n ? Number((cents * 10000n) / a.grandTotalCents) / 10000 : 0);
  return (
    <Section id="spend" eyebrow="01 · Decrypted on chain totals" title="Spend breakdown" lede="Per-category totals the contract summed over the encrypted bills, decrypted for your wallet only.">
      <Card>
        <ChartFrame
          title="Spend by category"
          subtitle={`${formatBillAmount(a.grandTotalCents)} across ${a.billCount} bills`}
          table={{
            columns: ["Category", "Spend", "Share"],
            rows: rows.map((r) => [r.label, formatBillAmount(r.cents), percent(share(r.cents))]),
          }}
        >
          <BarList
            items={rows.map((r) => ({
              label: r.label,
              value: centsToRupees(r.cents),
              display: `${formatBillAmount(r.cents)} · ${percent(share(r.cents))}`,
              note: `${percent(share(r.cents))} of all spend`,
            }))}
          />
        </ChartFrame>
      </Card>
    </Section>
  );
}

// ---------------------------------------------------------------- 02 monthly trend + forecast

export function TrendSection({ a, sellerPanel }: { a: DatasetAnalytics; sellerPanel?: ReactNode }) {
  const ins = a.insights;
  return (
    <Section
      id="trend"
      eyebrow="02 · Concrete ML forecast"
      title="Monthly trend and forecast"
      lede="Six months of spend and next month's prediction. The forecast model ran on an FHE server that only ever saw ciphertexts."
    >
      {ins ? (
        <Card>
          <TrendChart ins={ins} />
        </Card>
      ) : (
        <Empty>
          <p>The seller has not run the encrypted models on this dataset yet.</p>
        </Empty>
      )}
      {sellerPanel}
    </Section>
  );
}

function TrendChart({ ins }: { ins: NonNullable<DatasetAnalytics["insights"]> }) {
  const labels = [...ins.monthTotalsCents.map((_, i) => monthLabel(ins.monthStart + i)), monthLabel(ins.monthStart + 6)];
  const actual = [...ins.monthTotalsCents.map(centsToRupees), null];
  const forecast: (number | null)[] = labels.map(() => null);
  forecast[5] = actual[5];
  forecast[6] = centsToRupees(ins.forecastCents);
  return (
    <ChartFrame
      title="Spend per month"
      subtitle={`Forecast for ${labels[6]}: ${formatBillAmount(ins.forecastCents)}`}
      legend={[
        { label: "Actual spend", color: SERIES_COLORS[0] },
        { label: "ML forecast", color: SERIES_COLORS[1], dashed: true },
      ]}
      table={{
        columns: ["Month", "Spend"],
        rows: [
          ...ins.monthTotalsCents.map((c, i) => [labels[i], formatBillAmount(c)]),
          [`${labels[6]} (forecast)`, formatBillAmount(ins.forecastCents)],
        ],
      }}
    >
      <LineChart
        labels={labels}
        format={compactRupees}
        series={[
          { name: "Actual spend", values: actual, color: SERIES_COLORS[0] },
          { name: "ML forecast", values: forecast, color: SERIES_COLORS[1], dashed: true },
        ]}
      />
    </ChartFrame>
  );
}

// ---------------------------------------------------------------- 03 anomaly view

export function AnomalySection({ a, run }: { a: DatasetAnalytics; run: MlRun | null }) {
  const ins = a.insights;
  return (
    <Section
      id="anomalies"
      eyebrow="03 · Encrypted anomaly detection"
      title="Anomaly view"
      lede="How unusual each bill looked to the anomaly model, as a histogram of scores. Only the counts per band are stored, never a bill's own score."
    >
      {ins ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <ChartFrame
              title="Bills per anomaly score"
              subtitle="0 looks normal, 1 looks anomalous. The model flags a bill at 0.5 or above."
              table={{ columns: ["Score band", "Bills"], rows: SCORE_BANDS.map((b, i) => [b, ins.scoreBuckets[i] ?? 0]) }}
            >
              <ColumnChart
                labels={SCORE_BANDS}
                format={(v) => String(Math.round(v))}
                tipLabel={(i) => `Score ${SCORE_BANDS[i]}`}
                series={[{ name: "Bills", values: ins.scoreBuckets, color: SERIES_COLORS[0] }]}
              />
            </ChartFrame>
          </Card>
          <Card>
            <ChartFrame
              title="Model vs fixed rule"
              subtitle="Bills each method flags as anomalous"
              table={{
                columns: ["Method", "Flagged"],
                rows: [
                  ["Concrete ML model", ins.mlAnomalyCount],
                  ["Fixed threshold", a.anomalyCount],
                  ["All bills", a.billCount],
                ],
              }}
            >
              <BarList
                items={[
                  { label: "Concrete ML model", value: ins.mlAnomalyCount, display: `${ins.mlAnomalyCount} of ${a.billCount}` },
                  {
                    label: `Rule: above ${formatBillAmount(a.anomalyThresholdCents)}`,
                    value: a.anomalyCount,
                    display: `${a.anomalyCount} of ${a.billCount}`,
                  },
                ]}
              />
            </ChartFrame>
          </Card>
          {run ? (
            <Card className="lg:col-span-3">
              <ChartFrame
                title="Your bills, scored (seller only)"
                subtitle="Each bill's decrypted score from this run. Shown on your screen only; nothing per-bill is stored on chain."
                table={{ columns: ["Bill", "Score"], rows: run.scores.map((s, i) => [`#${i + 1}`, s.toFixed(3)]) }}
              >
                <ColumnChart
                  labels={run.scores.map((_, i) => `#${i + 1}`)}
                  format={(v) => v.toFixed(2)}
                  tipLabel={(i) => `Bill #${i + 1}`}
                  series={[{ name: "Anomaly score", values: run.scores, color: SERIES_COLORS[0] }]}
                />
              </ChartFrame>
            </Card>
          ) : null}
        </div>
      ) : (
        <Empty>
          <p>No encrypted anomaly scores yet. The fixed rule above still counts {a.anomalyCount} bills over {formatBillAmount(a.anomalyThresholdCents)}.</p>
        </Empty>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------- seller: run the encrypted models

const STEPS: { key: MlStep; label: string; detail: string }[] = [
  { key: "decrypting", label: "Decrypt your bills", detail: "Your wallet signs; only you can read the per-bill values." },
  { key: "inference", label: "Run the models blind", detail: "The local helper encrypts each bill; the FHE server scores ciphertexts." },
  { key: "storing", label: "Re-encrypt the insights", detail: "The aggregate results are encrypted with FHEVM; approve the transaction." },
  { key: "confirming", label: "Store on chain", detail: "Buyers of this dataset are granted the new insights automatically." },
];
const ORDER: MlStep[] = ["idle", "decrypting", "inference", "storing", "confirming", "done"];

export function RunMlPanel({ datasetId, onRun }: { datasetId: string; onRun: (run: MlRun | null) => void }) {
  const { step, error, run, start } = useRunMl(datasetId);
  const [health, setHealth] = useState<{ helper: boolean; server: boolean } | null>(null);
  const busy = step !== "idle" && step !== "done" && step !== "error";

  useEffect(() => {
    let live = true;
    void helperHealthy().then((h) => live && setHealth(h));
    return () => {
      live = false;
    };
  }, [step]);
  useEffect(() => onRun(run), [run, onRun]);

  const reached = (k: MlStep) => ORDER.indexOf(step === "error" ? "idle" : step) > ORDER.indexOf(k) || step === "done";

  return (
    <Card glow>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Run encrypted ML (seller)</h3>
          <span className="inline-flex items-center gap-2 text-sm text-muted">
            <span
              className="inline-block size-2.5 rounded-full"
              style={{ background: health === null ? "#9fb0d6" : health.helper && health.server ? "#0ca30c" : "#d03b3b" }}
              aria-hidden
            />
            {health === null
              ? "Checking the ML helper..."
              : health.helper && health.server
                ? "ML helper and FHE server running"
                : health.helper
                  ? "Helper running, FHE server unreachable"
                  : "ML helper not running (docker compose up in ml/)"}
          </span>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => {
            const done = reached(s.key);
            const active = step === s.key;
            return (
              <li
                key={s.key}
                className={`flex flex-col gap-1 rounded-lg border p-3 ${active ? "border-accent-bright/60 bg-accent/10" : "border-border"}`}
              >
                <span className="inline-flex items-center gap-2 text-sm font-medium">
                  {done ? <CheckIcon width={16} height={16} className="text-success" /> : <span className="tabular-nums text-muted">{i + 1}</span>}
                  {s.label}
                </span>
                <span className="text-sm text-muted">{s.detail}</span>
              </li>
            );
          })}
        </ol>
        {error ? (
          <p role="alert" className="flex items-center gap-2 text-sm text-danger">
            <AlertIcon width={16} height={16} />
            {error}
          </p>
        ) : null}
        {run ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
            <dt className="text-muted">Bills scored</dt>
            <dd className="tabular-nums">{run.trace.bills}</dd>
            <dt className="text-muted">Round trip</dt>
            <dd className="tabular-nums">{`${run.trace.seconds}s`}</dd>
            <dt className="text-muted">Ciphertext sent</dt>
            <dd className="tabular-nums">{`${(run.trace.bytesSent / 1e6).toFixed(1)} MB`}</dd>
            <dt className="text-muted">Ciphertext back</dt>
            <dd className="tabular-nums">{`${(run.trace.bytesReceived / 1e3).toFixed(0)} kB`}</dd>
            <dt className="col-span-2 text-muted sm:col-span-4">What the FHE server received (first bytes)</dt>
            <dd className="col-span-2 break-all font-mono text-xs text-muted sm:col-span-4">{run.trace.ciphertextPreview}…</dd>
          </dl>
        ) : null}
        <div>
          <Button onClick={() => void start()} loading={busy}>
            {busy ? "Running..." : step === "done" ? "Run again" : "Run encrypted ML"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- 04 model card

export function ModelCardSection() {
  const card = useModelCard();
  return (
    <Section
      id="model"
      eyebrow="04 · Public model card"
      title="How the models were trained"
      lede="Both models were trained on synthetic bills, compiled to FHE circuits with Concrete ML, and checked against their plaintext twins."
    >
      {card.data ? (
        <ModelCardBody card={card.data} />
      ) : (
        <Empty>
          <p>{card.isPending ? "Loading the model card..." : "No model card yet. Run `docker compose up --build` in the ml folder once; the trainer writes it."}</p>
        </Empty>
      )}
    </Section>
  );
}

function ModelCardBody({ card }: { card: ModelCard }) {
  const an = card.anomaly;
  const fc = card.forecast;
  const amountLabels = an.amountHistogram.edgesRupees.slice(0, -1).map((e) => compactRupees(e));
  const scoreLabels = an.scoreHistogram.edges.slice(0, -1).map((e) => e.toFixed(1));
  const backtestLabels = fc.backtest.map((b) => `M${b.month + 1}`);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Anomaly accuracy" value={percent(an.accuracy)} hint={`Precision ${percent(an.precision)} · recall ${percent(an.recall)}`} />
        <Stat label="FHE vs plaintext" value={percent(an.fhe.agreement, 0)} hint={`Same answer on ${an.fhe.samples} encrypted test bills`} />
        <Stat label="Encrypted inference" value={`${Math.round(an.fhe.msPerBill)} ms`} hint="Per bill, on the FHE server" />
        <Stat label="Forecast error" value={compactRupees(fc.maeRupees)} hint={`Mean absolute error · R² ${fc.r2.toFixed(2)}`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <ChartFrame
            title="Training data: bill amounts"
            subtitle={`${an.trainSize + an.testSize} synthetic bills, log-spaced amount bins (test split shown)`}
            legend={[
              { label: "Normal", color: SERIES_COLORS[0] },
              { label: "Anomalous", color: SERIES_COLORS[1] },
            ]}
            table={{
              columns: ["From", "Normal", "Anomalous"],
              rows: amountLabels.map((l, i) => [l, an.amountHistogram.normal[i], an.amountHistogram.anomalous[i]]),
            }}
          >
            <ColumnChart
              labels={amountLabels}
              format={(v) => String(Math.round(v))}
              tipLabel={(i) => `${amountLabels[i]} – ${compactRupees(an.amountHistogram.edgesRupees[i + 1])}`}
              series={[
                { name: "Normal", values: an.amountHistogram.normal, color: SERIES_COLORS[0] },
                { name: "Anomalous", values: an.amountHistogram.anomalous, color: SERIES_COLORS[1] },
              ]}
            />
          </ChartFrame>
        </Card>
        <Card>
          <ChartFrame
            title="Predicted anomaly score on test bills"
            subtitle="A good model pushes normal bills left and anomalous bills right"
            legend={[
              { label: "Normal", color: SERIES_COLORS[0] },
              { label: "Anomalous", color: SERIES_COLORS[1] },
            ]}
            table={{
              columns: ["Score from", "Normal", "Anomalous"],
              rows: scoreLabels.map((l, i) => [l, an.scoreHistogram.normal[i], an.scoreHistogram.anomalous[i]]),
            }}
          >
            <ColumnChart
              labels={scoreLabels}
              format={(v) => String(Math.round(v))}
              tipLabel={(i) => `Score ${scoreLabels[i]}–${an.scoreHistogram.edges[i + 1].toFixed(1)}`}
              series={[
                { name: "Normal", values: an.scoreHistogram.normal, color: SERIES_COLORS[0] },
                { name: "Anomalous", values: an.scoreHistogram.anomalous, color: SERIES_COLORS[1] },
              ]}
            />
          </ChartFrame>
        </Card>
        <Card>
          <ChartFrame
            title="Forecast backtest"
            subtitle="One synthetic household: what the model predicted each month vs what was spent"
            legend={[
              { label: "Actual", color: SERIES_COLORS[0] },
              { label: "Predicted", color: SERIES_COLORS[1], dashed: true },
            ]}
            table={{
              columns: ["Month", "Actual", "Predicted"],
              rows: fc.backtest.map((b, i) => [backtestLabels[i], compactRupees(b.actual), compactRupees(b.predicted)]),
            }}
          >
            <LineChart
              labels={backtestLabels}
              format={compactRupees}
              series={[
                { name: "Actual", values: fc.backtest.map((b) => b.actual), color: SERIES_COLORS[0] },
                { name: "Predicted", values: fc.backtest.map((b) => b.predicted), color: SERIES_COLORS[1], dashed: true },
              ]}
            />
          </ChartFrame>
        </Card>
        <Card>
          <ChartFrame
            title="Confusion matrix (test bills)"
            subtitle={`${an.model}, ${an.nBits}-bit quantized · F1 ${an.f1.toFixed(2)}`}
            table={{
              columns: ["Actual", "Predicted normal", "Predicted anomalous"],
              rows: [
                ["Normal", an.confusion.tn, an.confusion.fp],
                ["Anomalous", an.confusion.fn, an.confusion.tp],
              ],
            }}
          >
            <MatrixChart
              rowTitle="Actual"
              colTitle="Predicted"
              rowLabels={["Normal", "Anomalous"]}
              colLabels={["Normal", "Anomalous"]}
              values={[
                [an.confusion.tn, an.confusion.fp],
                [an.confusion.fn, an.confusion.tp],
              ]}
            />
          </ChartFrame>
        </Card>
      </div>
      <Card>
        <ChartFrame
          title="Anomaly rate by category (test bills)"
          table={{
            columns: ["Category", "Bills", "Anomalous", "Flagged by model"],
            rows: an.perCategory.map((c) => [c.category, c.bills, c.anomalies, c.flagged]),
          }}
        >
          <BarList
            items={an.perCategory.map((c) => ({
              label: c.category,
              value: c.bills > 0 ? c.anomalies / c.bills : 0,
              display: `${c.bills > 0 ? percent(c.anomalies / c.bills) : "0%"} of ${c.bills}`,
              note: `Model flagged ${c.flagged}`,
            }))}
          />
        </ChartFrame>
      </Card>
      <p className="text-sm text-muted">
        {`Trained ${new Date(card.generatedAt).toLocaleString("en-GB")} on ${card.data} data. Anomaly features: ${an.features.join(", ")}. Forecast features: ${fc.features.join(", ")}. FHE forecast differs from plaintext by at most ${compactRupees(fc.fhe.maxAbsDiffRupees)}.`}
      </p>
    </div>
  );
}
