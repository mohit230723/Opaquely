import type { ReactNode } from "react";

export type StatusChipVariant = "neutral" | "info" | "success" | "danger";

const variants: Record<StatusChipVariant, { text: string; dot: string }> = {
  neutral: { text: "text-muted", dot: "bg-muted" },
  info: { text: "text-accent-bright", dot: "bg-accent-bright" },
  success: { text: "text-success", dot: "bg-success" },
  danger: { text: "text-danger", dot: "bg-danger" },
};

/** 24px pill. Always a leading dot plus text, never color alone. */
export function StatusChip({
  variant = "neutral",
  children,
  className = "",
}: {
  variant?: StatusChipVariant;
  children: ReactNode;
  className?: string;
}) {
  const v = variants[variant];
  return (
    <span
      className={`inline-flex h-6 items-center gap-1 rounded-full border border-border bg-surface-raised px-2 text-sm font-semibold ${v.text} ${className}`.trim()}
    >
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${v.dot}`} />
      {children}
    </span>
  );
}
