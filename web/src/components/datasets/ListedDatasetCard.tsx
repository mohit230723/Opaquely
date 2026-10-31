import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusChip, type StatusChipVariant } from "@/components/ui/StatusChip";
import type { Dataset } from "@/data/types";
import { MIN_BILLS_TO_LIST } from "@/lib/constants";
import { formatEth, plural } from "@/lib/format";
import type { ListingSales } from "@/lib/my-sales";

/** Where the sold figures come from: the activity read, which may still be loading or may have failed. */
export type SalesState = "pending" | "error" | "ready";

export interface ListedDatasetCardProps {
  dataset: Dataset;
  /** Sales of this dataset's listing (deriveSales), undefined when it has none or they are not known yet. */
  sales: ListingSales | undefined;
  salesState: SalesState;
}

function chipFor(dataset: Dataset, sold: boolean): { label: string; variant: StatusChipVariant } {
  switch (dataset.status) {
    case "open":
      return { label: "Draft", variant: "neutral" };
    // Sealed is the short moment between sealing and the listing confirming; it has no action of its own.
    case "sealed":
      return { label: "Sealed", variant: "neutral" };
    case "listed":
      return sold ? { label: "Sold", variant: "info" } : { label: "Listed", variant: "success" };
  }
}

/**
 * One dataset this wallet created, as a GlowCard: a content block and, for a draft, a footer that goes back to
 * Upload. The card renders from useMyDatasets alone; the sold line fills in when the activity read resolves,
 * and a failed activity read adds nothing (the card never blanks).
 */
export function ListedDatasetCard({ dataset, sales, salesState }: ListedDatasetCardProps) {
  const listed = dataset.status === "listed";
  const sold = listed && salesState === "ready" && sales !== undefined && sales.count > 0;
  const chip = chipFor(dataset, sold);
  const price = dataset.priceWei;

  return (
    <Card as="li" glow data-testid="listed-dataset" className="min-w-0">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 className="min-w-0 text-base font-semibold wrap-break-word">{dataset.name}</h3>
          <StatusChip variant={chip.variant}>{chip.label}</StatusChip>
        </div>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          {listed && price !== undefined ? <span className="tabular-nums">{`Price ${formatEth(price)}`}</span> : null}
          <span>{plural(dataset.billCount, "bill")}</span>
        </p>
        {sold && sales !== undefined && price !== undefined ? (
          <div className="flex flex-col gap-1">
            <p className="text-2xl font-semibold leading-tight tabular-nums">{`Sold for ${formatEth(sales.totalWei)}`}</p>
            <p className="text-sm text-muted">{`${plural(sales.count, "buyer")} at ${formatEth(price)} each`}</p>
          </div>
        ) : null}
        {listed && salesState === "pending" ? <p className="text-sm text-muted">Checking sales...</p> : null}
      </div>
      {dataset.status === "open" ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted tabular-nums">{`${dataset.billCount} of ${MIN_BILLS_TO_LIST} bills`}</span>
          <Button variant="secondary" href={`/upload?dataset=${encodeURIComponent(dataset.id)}`}>
            Continue in Upload
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted">Your encrypted totals</span>
          <Button variant="secondary" href={`/analytics/${encodeURIComponent(dataset.id)}`}>
            View Analytics
          </Button>
        </div>
      )}
    </Card>
  );
}
