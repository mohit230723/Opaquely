import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";

export interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

/** Centered heading, body and at most one primary action. All text renders as React text. */
export function EmptyState({
  heading,
  children,
  action,
}: {
  heading: string;
  children?: ReactNode;
  action?: EmptyStateAction;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      <h2 className="text-2xl font-semibold leading-tight">{heading}</h2>
      {children ? <p className="mt-2 max-w-md text-muted">{children}</p> : null}
      {action ? (
        <div className="mt-6">
          <Button href={action.href} onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
