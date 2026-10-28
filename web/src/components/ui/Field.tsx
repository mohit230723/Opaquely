import { useId } from "react";
import type { InputHTMLAttributes, ReactNode, Ref, TextareaHTMLAttributes } from "react";
import { AlertIcon } from "@/components/icons";

type ControlProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "prefix"> &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "prefix">;

export interface FieldProps extends ControlProps {
  label: ReactNode;
  /** One error per field, shown below the control. */
  error?: string;
  helper?: ReactNode;
  /** Render a textarea instead of an input. */
  multiline?: boolean;
  /** Adornment inside the control, left (for example the bill currency symbol). */
  prefix?: ReactNode;
  /** Adornment inside the control, right (for example "ETH"). */
  suffix?: ReactNode;
  /** Ref to the control, so forms can focus the first invalid field. */
  ref?: Ref<HTMLInputElement & HTMLTextAreaElement>;
}

export function Field({
  label,
  error,
  helper,
  multiline = false,
  prefix,
  suffix,
  className = "",
  ref,
  ...control
}: FieldProps) {
  const id = useId();
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const describedBy = [error ? errorId : null, helper ? helperId : null].filter(Boolean).join(" ") || undefined;

  const controlClass =
    "w-full bg-transparent px-3 text-base text-text placeholder:text-muted focus-visible:outline-none disabled:cursor-not-allowed disabled:text-muted";

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold">
        {label}
      </label>
      <div
        className={`flex items-center rounded-lg border bg-bg focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent-bright ${
          error ? "border-danger" : "border-border-strong"
        } ${multiline ? "items-start" : "h-11"}`}
      >
        {prefix ? <span className="pl-3 text-muted">{prefix}</span> : null}
        {multiline ? (
          <textarea
            {...(control as TextareaHTMLAttributes<HTMLTextAreaElement>)}
            ref={ref as Ref<HTMLTextAreaElement>}
            id={id}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={`${controlClass} min-h-24 py-2`}
          />
        ) : (
          <input
            {...(control as InputHTMLAttributes<HTMLInputElement>)}
            ref={ref as Ref<HTMLInputElement>}
            id={id}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={`${controlClass} h-full`}
          />
        )}
        {suffix ? <span className="pr-3 text-muted">{suffix}</span> : null}
      </div>
      {error ? (
        <p id={errorId} className="mt-2 flex items-start gap-2 text-sm text-danger">
          <AlertIcon className="mt-0.5 shrink-0" width={16} height={16} />
          <span>{error}</span>
        </p>
      ) : null}
      {helper ? (
        <p id={helperId} className="mt-2 text-sm text-muted">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
