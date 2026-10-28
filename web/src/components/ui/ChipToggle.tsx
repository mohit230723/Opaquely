"use client";

import { useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";

export interface ChipToggleProps {
  children: ReactNode;
  selected: boolean;
  onToggle: () => void;
  /** "checkbox" for multi-select filters, "radio" for a single choice. */
  mode?: "checkbox" | "radio";
  /** Radio mode: only the selected chip (or the first, when none) is tabbable. */
  tabbable?: boolean;
  disabled?: boolean;
  className?: string;
}

export function ChipToggle({
  children,
  selected,
  onToggle,
  mode = "checkbox",
  tabbable = true,
  disabled = false,
  className = "",
}: ChipToggleProps) {
  return (
    <button
      type="button"
      role={mode}
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      tabIndex={tabbable ? 0 : -1}
      onClick={() => {
        if (!disabled) onToggle();
      }}
      className={`inline-flex h-11 items-center justify-center rounded-full border px-4 text-sm font-semibold transition-colors duration-150 ${
        selected
          ? "border-accent-bright bg-accent text-[#f6f8ff]"
          : "border-border-strong bg-transparent text-text hover:bg-surface-raised"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""} ${className}`.trim()}
    >
      {children}
    </button>
  );
}

export interface ChipGroupOption<V extends string | number> {
  value: V;
  label: ReactNode;
}

interface ChipGroupBase<V extends string | number> {
  label: string;
  options: ChipGroupOption<V>[];
  className?: string;
}

export type ChipGroupProps<V extends string | number> =
  | (ChipGroupBase<V> & { mode: "checkbox"; value: V[]; onChange: (next: V[]) => void })
  | (ChipGroupBase<V> & { mode: "radio"; value: V | undefined; onChange: (next: V) => void });

/** Multi-select (role group of checkboxes) or single-select (radiogroup with arrow keys). */
export function ChipGroup<V extends string | number>(props: ChipGroupProps<V>) {
  const { label, options, className = "" } = props;
  const container = useRef<HTMLDivElement | null>(null);

  if (props.mode === "checkbox") {
    const { value, onChange } = props;
    return (
      <div role="group" aria-label={label} className={`flex flex-wrap gap-2 ${className}`.trim()}>
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <ChipToggle
              key={String(o.value)}
              mode="checkbox"
              selected={on}
              onToggle={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
            >
              {o.label}
            </ChipToggle>
          );
        })}
      </div>
    );
  }

  const { value, onChange } = props;
  const selectedIndex = options.findIndex((o) => o.value === value);
  const tabIndexFor = selectedIndex === -1 ? 0 : selectedIndex;

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
    const backward = e.key === "ArrowLeft" || e.key === "ArrowUp";
    if (!forward && !backward) return;
    e.preventDefault();
    const from = selectedIndex === -1 ? (forward ? -1 : 0) : selectedIndex;
    const next = (from + (forward ? 1 : -1) + options.length) % options.length;
    onChange(options[next].value);
    const buttons = container.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    buttons?.[next]?.focus();
  }

  return (
    <div
      ref={container}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={`flex flex-wrap gap-2 ${className}`.trim()}
    >
      {options.map((o, i) => (
        <ChipToggle
          key={String(o.value)}
          mode="radio"
          selected={o.value === value}
          tabbable={i === tabIndexFor}
          onToggle={() => onChange(o.value)}
        >
          {o.label}
        </ChipToggle>
      ))}
    </div>
  );
}
