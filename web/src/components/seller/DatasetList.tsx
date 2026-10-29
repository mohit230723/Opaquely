"use client";

import Link from "next/link";
import { StatusChip, type StatusChipVariant } from "@/components/ui/StatusChip";
import { Button } from "@/components/ui/Button";
import type { Dataset, DatasetStatus } from "@/data/types";
import { MIN_BILLS_TO_LIST } from "@/lib/constants";
import { formatDate } from "@/lib/format";

const STATUS: Record<DatasetStatus, { label: string; variant: StatusChipVariant }> = {
  open: { label: "Open", variant: "neutral" },
  sealed: { label: "Sealed", variant: "info" },
  listed: { label: "Listed", variant: "success" },
};

const cell = "max-md:flex max-md:items-center max-md:justify-between max-md:gap-3 max-md:py-1 md:px-4 md:py-3 md:align-middle";
const mobileLabel = "text-sm text-muted md:hidden";

/**
 * Datasets for the seller. One table in the DOM: from 768px it is a table inside a card, below 768px
 * every row is displayed as its own stacked card, so there is a single set of links and no horizontal scroll.
 */
export function DatasetList({ datasets, limit }: { datasets: Dataset[]; limit?: number }) {
  const rows = [...datasets].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit ?? datasets.length);

  return (
    <div className="md:rounded-xl md:border md:border-border md:bg-surface md:p-2">
      <table className="w-full max-md:block">
        <caption className="sr-only">Your datasets</caption>
        <thead className="max-md:hidden">
          <tr className="text-left text-sm text-muted">
            <th scope="col" className="px-4 py-3 font-semibold">
              Name
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Bills
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Status
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Created
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="max-md:block">
          {rows.map((d) => {
            const base = `/sell/datasets/${d.id}`;
            const isOpen = d.status === "open";
            const underMinimum = d.billCount < MIN_BILLS_TO_LIST;
            return (
              <tr
                key={d.id}
                className="max-md:mb-4 max-md:block max-md:rounded-xl max-md:border max-md:border-border max-md:bg-surface max-md:p-4 md:border-t md:border-border md:first:border-t-0"
              >
                <td className={`${cell} min-w-0`}>
                  <span className={mobileLabel}>Name</span>
                  <Link
                    href={base}
                    className="min-w-0 text-base font-semibold text-text underline-offset-4 hover:underline wrap-break-word max-md:text-right"
                  >
                    {d.name}
                  </Link>
                </td>
                <td className={`${cell} tabular-nums`}>
                  <span className={mobileLabel}>Bills</span>
                  <span>{d.billCount}</span>
                </td>
                <td className={cell}>
                  <span className={mobileLabel}>Status</span>
                  <StatusChip variant={STATUS[d.status].variant}>{STATUS[d.status].label}</StatusChip>
                </td>
                <td className={cell}>
                  <span className={mobileLabel}>Created</span>
                  <span>{formatDate(d.createdAt)}</span>
                </td>
                <td className={`${cell} max-md:pt-3`}>
                  <div className="flex flex-wrap items-center gap-2">
                    {isOpen ? (
                      <Button variant="secondary" href={`${base}/add`}>
                        Add bill
                      </Button>
                    ) : null}
                    {isOpen ? (
                      <span className="flex flex-wrap items-center gap-2">
                        <Button variant="secondary" href={`${base}/list`} disabled={underMinimum}>
                          List dataset
                        </Button>
                        {underMinimum ? (
                          <span className="text-sm text-muted">Needs {MIN_BILLS_TO_LIST} bills</span>
                        ) : null}
                      </span>
                    ) : null}
                    <Button variant="secondary" href={`${base}/chain-view`}>
                      Chain view
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
