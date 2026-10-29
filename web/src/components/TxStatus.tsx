import type { ReactNode } from "react";
import { AlertIcon, CheckIcon, SpinnerIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { shortHash } from "@/lib/format";
import type { TxState } from "@/lib/tx-machine";

type StepVisual = "done" | "current" | "future" | "success" | "failed";

const BASE_LABELS = ["Awaiting signature", "Pending"] as const;

/** Which step is current (1 to 3) and how the third step ends. */
function stepOf(state: Exclude<TxState, { phase: "idle" }>): { current: number; last: "Confirmed" | "Failed" } {
  switch (state.phase) {
    case "awaiting_signature":
      return { current: 1, last: "Confirmed" };
    case "pending":
      return { current: 2, last: "Confirmed" };
    case "confirmed":
      return { current: 3, last: "Confirmed" };
    case "failed":
      // A failure with a hash happened after submission; without one it happened before signing,
      // so the stepper must not claim "Awaiting signature" or "Pending" completed.
      return state.hash ? { current: 3, last: "Failed" } : { current: 1, last: "Confirmed" };
  }
}

function visualFor(index: number, state: Exclude<TxState, { phase: "idle" }>): StepVisual {
  const { current } = stepOf(state);
  const n = index + 1;
  if (n < current) return "done";
  if (n > current) return "future";
  if (state.phase === "confirmed") return "success";
  if (state.phase === "failed") return "failed";
  return "current";
}

const circleClass: Record<StepVisual, string> = {
  done: "border-accent-bright bg-accent-bright text-bg",
  current: "border-accent-bright text-accent-bright",
  future: "border-border-strong text-muted",
  success: "border-success bg-success text-bg",
  failed: "border-danger bg-danger text-bg",
};

function StepDot({ n, visual }: { n: number; visual: StepVisual }) {
  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold ${circleClass[visual]}`}
    >
      {visual === "done" || visual === "success" ? (
        <CheckIcon width={14} height={14} strokeWidth={2.5} />
      ) : visual === "failed" ? (
        <AlertIcon width={14} height={14} strokeWidth={2.5} />
      ) : (
        n
      )}
    </span>
  );
}

function Hash({ value }: { value: string }) {
  return (
    <span className="font-mono" title={value}>
      {shortHash(value)}
    </span>
  );
}

/**
 * One transaction panel for every write: three steps, a title and a message per phase.
 * idle renders nothing. All text is React text; the full hash lives in the title attribute.
 */
export function TxStatus({ state, onRetry }: { state: TxState; onRetry?: () => void }) {
  if (state.phase === "idle") return null;

  const { current, last } = stepOf(state);
  const labels = [...BASE_LABELS, last];

  let title: string;
  let message: ReactNode;
  let icon: ReactNode;
  let border = "border-border";
  switch (state.phase) {
    case "awaiting_signature":
      title = "Confirm in your wallet";
      message = "Waiting for you to sign the transaction.";
      icon = <SpinnerIcon className="text-accent-bright" />;
      break;
    case "pending":
      title = "Transaction pending";
      message = (
        <>
          Submitted <Hash value={state.hash} />. Waiting for confirmation.
        </>
      );
      icon = <SpinnerIcon className="text-accent-bright" />;
      break;
    case "confirmed":
      title = "Transaction confirmed";
      message = <Hash value={state.hash} />;
      icon = <CheckIcon className="text-success" />;
      border = "border-success";
      break;
    case "failed":
      title = "Transaction failed";
      message = state.reason;
      icon = <AlertIcon className="text-danger" />;
      border = "border-danger";
      break;
  }

  const failed = state.phase === "failed";

  return (
    <div
      role={failed ? "alert" : "status"}
      aria-live={failed ? undefined : "polite"}
      className={`mt-6 rounded-lg border bg-surface-raised p-4 ${border}`}
    >
      <ol className="mb-4 flex items-center gap-2" aria-label="Transaction steps">
        {labels.map((label, i) => {
          const visual = visualFor(i, state);
          return (
            <li key={label} className="flex min-w-0 items-center gap-2" aria-current={i + 1 === current ? "step" : undefined}>
              <StepDot n={i + 1} visual={visual} />
              <span className={`hidden text-sm sm:inline ${visual === "future" ? "text-muted" : "text-text"}`}>{label}</span>
              {i < labels.length - 1 ? <span aria-hidden="true" className="h-px w-4 bg-border-strong sm:w-8" /> : null}
            </li>
          );
        })}
        <li className="ml-auto text-sm text-muted sm:hidden">Step {current} of 3</li>
      </ol>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="text-base font-semibold">{title}</p>
          <p className="mt-1 text-sm text-muted wrap-break-word">{message}</p>
        </div>
      </div>
      {failed && onRetry ? (
        <div className="mt-4">
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}
    </div>
  );
}
