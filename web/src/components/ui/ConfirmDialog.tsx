"use client";

import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { Button } from "./Button";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  /** Verb plus noun, for example "Seal and list dataset". */
  confirmLabel: string;
  /** Verb plus noun, for example "Keep editing dataset". */
  dismissLabel: string;
  onConfirm: () => void;
  onDismiss: () => void;
  /** Esc. Defaults to onDismiss; set it when the dismiss button does more than close (for example navigates). */
  onEscape?: () => void;
  /** While busy, dismiss and Esc are blocked and the confirm button shows a spinner. */
  busy?: boolean;
  /** Slot under the body for the transaction status and the success action. */
  footer?: ReactNode;
  /** Hide the confirm button, for example once the transaction has confirmed. */
  hideConfirm?: boolean;
}

/** Native dialog for irreversible actions. Focus returns to the element that opened it. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  dismissLabel,
  onConfirm,
  onDismiss,
  onEscape,
  busy = false,
  footer,
  hideConfirm = false,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
      trigger.current?.focus();
      trigger.current = null;
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-busy={busy || undefined}
      onCancel={(e) => {
        // Esc. Blocked while a transaction is in flight.
        e.preventDefault();
        if (!busy) (onEscape ?? onDismiss)();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-120 rounded-xl border border-border bg-surface p-6 text-text backdrop:bg-black/70"
    >
      <h2 id={titleId} className="text-base font-semibold">
        {title}
      </h2>
      <div className="mt-4 text-base">{children}</div>
      {footer ? <div className="mt-4">{footer}</div> : null}
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" disabled={busy} onClick={onDismiss}>
          {dismissLabel}
        </Button>
        {hideConfirm ? null : (
          <Button loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        )}
      </div>
    </dialog>
  );
}
