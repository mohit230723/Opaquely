"use client";

import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export type AsyncView = "pending" | "error" | "empty" | "content";

/** Which branch to render for a query. Pure, so it is unit-tested directly. */
export function asyncView<T>(
  query: Pick<UseQueryResult<T>, "status" | "data">,
  isEmpty?: (data: T) => boolean,
): AsyncView {
  if (query.status === "pending") return "pending";
  if (query.status === "error") return "error";
  if (isEmpty && isEmpty(query.data as T)) return "empty";
  return "content";
}

export interface AsyncBoundaryProps<T> {
  query: UseQueryResult<T>;
  /** Plural noun used in the loading and error messages, for example "datasets". */
  thing: string;
  skeleton: ReactNode;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  children: (data: T) => ReactNode;
}

/**
 * The only way query data is rendered. Pending shows the skeleton, error shows fixed copy with a
 * retry (the raw error is never rendered), empty shows the empty node, otherwise the content.
 */
export function AsyncBoundary<T>({ query, thing, skeleton, isEmpty, empty, children }: AsyncBoundaryProps<T>) {
  const view = asyncView(query, isEmpty);

  if (view === "pending") {
    return (
      <div aria-busy="true">
        <span className="sr-only">Loading {thing}</span>
        {skeleton}
      </div>
    );
  }

  if (view === "error") {
    return (
      <Card role="alert" className="border-danger">
        <h2 className="text-base font-semibold">Could not load {thing}</h2>
        <p className="mt-2 text-muted">Something went wrong while reading data. Try again.</p>
        <Button variant="secondary" className="mt-4" onClick={() => void query.refetch()}>
          Try again
        </Button>
      </Card>
    );
  }

  if (view === "empty") return <>{empty ?? null}</>;

  return <>{children(query.data as T)}</>;
}
