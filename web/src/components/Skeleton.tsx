/** Placeholder block. Size it with className, for example "h-24 w-full". Static under reduced motion. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton-pulse rounded-lg bg-surface-raised ${className}`.trim()} />;
}
