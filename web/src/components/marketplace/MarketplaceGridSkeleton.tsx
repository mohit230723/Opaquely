import { Skeleton } from "@/components/Skeleton";

/**
 * The marketplace grid: 3 columns from 1024px, 2 from 640px, 1 below, 24px gap. The tracks are fixed
 * (minmax(0, 22rem)), so a lone card in a row keeps the width of a normal card instead of stretching.
 */
export const MARKETPLACE_GRID =
  "grid grid-cols-1 gap-6 sm:grid-cols-[repeat(2,minmax(0,22rem))] lg:grid-cols-[repeat(3,minmax(0,22rem))]";

/** Six glow-card-shaped placeholders in the same grid while the listings load. */
export function MarketplaceGridSkeleton() {
  return (
    <div aria-busy="true" className={MARKETPLACE_GRID}>
      <span className="sr-only">Loading datasets</span>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex h-80 flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:p-6">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="mt-auto h-11 w-full" />
        </div>
      ))}
    </div>
  );
}
