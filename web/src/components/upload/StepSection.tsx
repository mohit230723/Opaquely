import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

/**
 * One numbered step of the Upload page: a `section` with an `h2` and the step number in a 32px outlined circle.
 * Not an `ol` (the only lists of steps in the app are How it works and the activity timeline). `quiet` mutes a
 * step that does not apply yet.
 */
export function StepSection({
  n,
  id,
  title,
  quiet = false,
  children,
}: {
  n: number;
  id: string;
  title: string;
  quiet?: boolean;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={quiet ? "opacity-70" : undefined}>
      <div className="mb-4 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent-bright text-sm font-semibold text-accent-bright"
        >
          {n}
        </span>
        <h2 id={id} className="text-xl font-semibold">
          {title}
        </h2>
      </div>
      <Card>{children}</Card>
    </section>
  );
}
