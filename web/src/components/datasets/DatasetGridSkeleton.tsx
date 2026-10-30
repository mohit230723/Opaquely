import { Skeleton } from "@/components/Skeleton";

/** My Datasets grid: 1 column, 2 from 768px, 24px gap. */
export const DATASET_GRID = "grid grid-cols-1 gap-6 md:grid-cols-2";

/**
 * Two glow-card-shaped placeholders in the My Datasets grid. With `label` it marks itself busy and carries the
 * sr-only label. Inside an AsyncBoundary leave `label` out: the boundary already wraps the skeleton in
 * aria-busy with `Loading {thing}`, and a second label would be announced twice.
 */
export function DatasetGridSkeleton({ label }: { label?: string }) {
  const blocks = (
    <div className={DATASET_GRID}>
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className="flex h-48 flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:p-6">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="mt-auto h-11 w-40" />
        </div>
      ))}
    </div>
  );
  if (label === undefined) return blocks;
  return (
    <div aria-busy="true">
      <span className="sr-only">{label}</span>
      {blocks}
    </div>
  );
}
