"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import "./charts.css";

/** Categorical slots, in fixed order: slot 1 blue, slot 2 orange. */
export const SERIES_COLORS = ["var(--series-1)", "var(--series-2)"] as const;

// Sequential blue (dark surface): the lowest step recedes toward the surface, the highest is the brightest.
const SEQUENTIAL = ["#104281", "#184f95", "#256abf", "#3987e5", "#6da7ec", "#9ec5f4"];

type Tip = { x: number; y: number; content: ReactNode } | null;

/** Hover tooltips positioned inside the chart's own box. */
function useTip() {
  const box = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip>(null);
  const show = (e: MouseEvent, content: ReactNode) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    setTip({ x: e.clientX - rect.left, y: e.clientY - rect.top, content });
  };
  return { box, tip, show, hide: () => setTip(null) };
}

function TipBox({ tip }: { tip: Tip }) {
  if (!tip) return null;
  return (
    <div className="viz-tip" style={{ left: tip.x, top: tip.y }}>
      {tip.content}
    </div>
  );
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

/** Round numbers for a y axis: 0 and up to four steps of 1, 2 or 5 x 10^n. */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const ticks = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

export interface LegendItem {
  label: string;
  color: string;
  dashed?: boolean;
}

export interface TableData {
  columns: string[];
  rows: (string | number)[][];
}

/** Title, legend (two or more series), the chart, and a table view of the same numbers. */
export function ChartFrame({
  title,
  subtitle,
  legend,
  table,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  legend?: LegendItem[];
  table?: TableData;
  children: ReactNode;
}) {
  return (
    <div className="viz-root flex min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold">{title}</h3>
        {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
      </div>
      {legend && legend.length > 1 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          {legend.map((l) => (
            <li key={l.label} className="inline-flex items-center gap-2">
              <span
                className={l.dashed ? "viz-swatch viz-swatch--dashed" : "viz-swatch"}
                style={l.dashed ? { color: l.color } : { background: l.color }}
                aria-hidden
              />
              {l.label}
            </li>
          ))}
        </ul>
      ) : null}
      {children}
      {table ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted hover:text-text">Show table</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="viz-table">
              <thead>
                <tr>
                  {table.columns.map((c) => (
                    <th key={c} scope="col" className="font-medium text-muted">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((cell, j) => (
                      <td key={j}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </div>
  );
}

export interface BarItem {
  label: string;
  value: number;
  /** The formatted value, shown at the bar end and in the tooltip. */
  display: string;
  /** Extra tooltip line, e.g. a share of the total. */
  note?: string;
}

/** Horizontal bars, one series, sorted by the caller. Labels sit above each bar, values at its end. */
export function BarList({ items, color = SERIES_COLORS[0] }: { items: BarItem[]; color?: string }) {
  const { box, tip, show, hide } = useTip();
  const max = Math.max(0, ...items.map((i) => i.value));
  return (
    <div ref={box} className="relative">
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li
            key={item.label}
            className="flex flex-col gap-1"
            onMouseMove={(e) =>
              show(
                e,
                <>
                  <div className="font-medium">{item.label}</div>
                  <div className="tabular-nums">{item.display}</div>
                  {item.note ? <div className="text-muted">{item.note}</div> : null}
                </>,
              )
            }
            onMouseLeave={hide}
          >
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span>{item.label}</span>
              <span className="tabular-nums text-muted">{item.display}</span>
            </div>
            <div className="h-2.5 w-full rounded-r bg-white/4">
              <div
                className="h-full rounded-r transition-[width] duration-700"
                style={{ width: `${max > 0 ? (item.value / max) * 100 : 0}%`, background: color, minWidth: item.value > 0 ? 4 : 0 }}
              />
            </div>
          </li>
        ))}
      </ul>
      <TipBox tip={tip} />
    </div>
  );
}

export interface Series {
  name: string;
  values: (number | null)[];
  color: string;
  dashed?: boolean;
}

const PAD = { top: 12, right: 12, bottom: 28, left: 52 };
const HEIGHT = 240;

function YAxis({ ticks, y, width, format }: { ticks: number[]; y: (v: number) => number; width: number; format: (v: number) => string }) {
  return (
    <g>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--viz-axis)" : "var(--viz-grid)"} />
          <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--color-muted)">
            {format(t)}
          </text>
        </g>
      ))}
    </g>
  );
}

/** Grouped columns: one or two series over ordered categories (histograms, buckets). */
export function ColumnChart({
  labels,
  series,
  format,
  tipLabel,
}: {
  labels: string[];
  series: Series[];
  format: (v: number) => string;
  /** The tooltip heading for a column, by index (defaults to its axis label). */
  tipLabel?: (i: number) => string;
}) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const { box, tip, show, hide } = useTip();
  const max = Math.max(0, ...series.flatMap((s) => s.values.map((v) => v ?? 0)));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const band = plotW / labels.length;
  const gap = 2;
  const barW = Math.max(2, (band * 0.8 - gap * (series.length - 1)) / series.length);
  const every = Math.ceil(labels.length / Math.max(1, Math.floor(plotW / 56)));

  return (
    <div ref={ref} className="w-full">
      <div ref={box} className="relative">
        <svg width={width} height={HEIGHT} role="img" aria-label={series.map((s) => s.name).join(", ")}>
          <YAxis ticks={ticks} y={y} width={width} format={format} />
          {labels.map((label, i) => {
            const x0 = PAD.left + i * band + band * 0.1;
            return (
              <g
                key={label + i}
                onMouseMove={(e) =>
                  show(
                    e,
                    <>
                      <div className="font-medium">{tipLabel ? tipLabel(i) : label}</div>
                      {series.map((s) => (
                        <div key={s.name} className="flex items-center gap-2 tabular-nums">
                          <span className="viz-swatch" style={{ background: s.color }} />
                          {series.length > 1 ? `${s.name}: ` : ""}
                          {format(s.values[i] ?? 0)}
                        </div>
                      ))}
                    </>,
                  )
                }
                onMouseLeave={hide}
              >
                <rect x={PAD.left + i * band} y={PAD.top} width={band} height={plotH} fill="transparent" />
                {series.map((s, k) => {
                  const v = s.values[i] ?? 0;
                  const h = Math.max(0, y(0) - y(v));
                  const x = x0 + k * (barW + gap);
                  const r = Math.min(4, barW / 2, h);
                  // Rounded data end, square at the baseline.
                  return h > 0 ? (
                    <path
                      key={s.name}
                      d={`M${x},${y(0)} V${y(v) + r} Q${x},${y(v)} ${x + r},${y(v)} H${x + barW - r} Q${x + barW},${y(v)} ${x + barW},${y(v) + r} V${y(0)} Z`}
                      fill={s.color}
                    />
                  ) : null;
                })}
                {i % every === 0 ? (
                  <text x={PAD.left + i * band + band / 2} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill="var(--color-muted)">
                    {label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
        <TipBox tip={tip} />
      </div>
    </div>
  );
}

/** Lines over ordered labels, with a crosshair tooltip listing every series at the hovered point. */
export function LineChart({ labels, series, format }: { labels: string[]; series: Series[]; format: (v: number) => string }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const { box, tip, show, hide } = useTip();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(0, ...series.flatMap((s) => s.values.map((v) => v ?? 0)));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const step = labels.length > 1 ? plotW / (labels.length - 1) : 0;
  const x = (i: number) => PAD.left + i * step;
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const every = Math.ceil(labels.length / Math.max(1, Math.floor(plotW / 64)));

  const path = (values: (number | null)[]) => {
    let d = "";
    let pen = false;
    values.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i)},${y(v)} `;
      pen = true;
    });
    return d;
  };

  const onMove = (e: MouseEvent<SVGRectElement>) => {
    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const i = Math.max(0, Math.min(labels.length - 1, Math.round((e.clientX - rect.left - PAD.left) / (step || 1))));
    setHover(i);
    show(
      e,
      <>
        <div className="font-medium">{labels[i]}</div>
        {series
          .filter((s) => s.values[i] !== null && s.values[i] !== undefined)
          .map((s) => (
            <div key={s.name} className="flex items-center gap-2 tabular-nums">
              <span className={s.dashed ? "viz-swatch viz-swatch--dashed" : "viz-swatch"} style={s.dashed ? { color: s.color } : { background: s.color }} />
              {`${s.name}: ${format(s.values[i] as number)}`}
            </div>
          ))}
      </>,
    );
  };

  return (
    <div ref={ref} className="w-full">
      <div ref={box} className="relative">
        <svg width={width} height={HEIGHT} role="img" aria-label={series.map((s) => s.name).join(", ")}>
          <YAxis ticks={ticks} y={y} width={width} format={format} />
          {labels.map((l, i) =>
            i % every === 0 || i === labels.length - 1 ? (
              <text key={l + i} x={x(i)} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill="var(--color-muted)">
                {l}
              </text>
            ) : null,
          )}
          {hover !== null ? <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--viz-axis)" /> : null}
          {series.map((s) => (
            <g key={s.name}>
              <path
                d={path(s.values)}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={s.dashed ? "6 5" : undefined}
              />
              {s.values.map((v, i) =>
                v === null || (labels.length > 12 && i !== hover) ? null : (
                  <circle key={i} cx={x(i)} cy={y(v)} r={4} fill={s.color} stroke="var(--viz-surface)" strokeWidth={2} />
                ),
              )}
            </g>
          ))}
          <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} fill="transparent" onMouseMove={onMove} onMouseLeave={() => { setHover(null); hide(); }} />
        </svg>
        <TipBox tip={tip} />
      </div>
    </div>
  );
}

/** A small labelled matrix (the confusion matrix) shaded on one sequential hue. */
export function MatrixChart({
  rowLabels,
  colLabels,
  values,
  rowTitle,
  colTitle,
}: {
  rowLabels: string[];
  colLabels: string[];
  values: number[][];
  rowTitle: string;
  colTitle: string;
}) {
  const { box, tip, show, hide } = useTip();
  const max = Math.max(1, ...values.flat());
  return (
    <div ref={box} className="relative">
      <div className="mb-1 pl-28 text-center text-xs text-muted">{colTitle}</div>
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `7rem repeat(${colLabels.length}, minmax(0, 1fr))` }}>
        <div className="flex items-end text-xs text-muted">{rowTitle}</div>
        {colLabels.map((c) => (
          <div key={c} className="pb-1 text-center text-sm text-muted">
            {c}
          </div>
        ))}
        {values.map((row, r) => (
          <div key={rowLabels[r]} className="contents">
            <div className="flex items-center text-sm text-muted">{rowLabels[r]}</div>
            {row.map((v, c) => {
              const step = Math.min(SEQUENTIAL.length - 1, Math.floor((v / max) * (SEQUENTIAL.length - 1)));
              return (
                <div
                  key={c}
                  className="flex h-20 items-center justify-center rounded-md text-lg font-semibold tabular-nums"
                  style={{ background: SEQUENTIAL[step], color: step >= 4 ? "#050816" : "#f6f8ff" }}
                  onMouseMove={(e) =>
                    show(
                      e,
                      <>
                        <div className="font-medium">{`${rowTitle} ${rowLabels[r]}, ${colTitle.toLowerCase()} ${colLabels[c]}`}</div>
                        <div className="tabular-nums">{`${v} bills`}</div>
                      </>,
                    )
                  }
                  onMouseLeave={hide}
                >
                  {v}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <TipBox tip={tip} />
    </div>
  );
}
