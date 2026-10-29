"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChipGroup } from "@/components/ui/ChipToggle";
import { Field } from "@/components/ui/Field";
import type { ListingFilter } from "@/data/types";
import { CATEGORIES } from "@/lib/categories";
import { isFilterActive, parseEthInput } from "@/lib/filter-listings";

const CATEGORY_OPTIONS = CATEGORIES.map((c) => ({ value: c.id as number, label: c.label }));

export interface ListingFiltersProps {
  filter: ListingFilter;
  onChange: (next: ListingFilter) => void;
}

/** Controlled filter bar. Instant: every change calls onChange, there is no submit. */
export function ListingFilters({ filter, onChange }: ListingFiltersProps) {
  const minError = parseEthInput(filter.minEth ?? "").error;
  const maxError = parseEthInput(filter.maxEth ?? "").error;

  return (
    <Card>
      <div className="flex flex-col gap-5">
        <Field
          label="Search"
          name="listing-search"
          type="search"
          placeholder="Search by title or seller"
          autoComplete="off"
          value={filter.query ?? ""}
          onChange={(e) => onChange({ ...filter, query: e.target.value })}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Min price (ETH)"
            name="listing-min-price"
            inputMode="decimal"
            autoComplete="off"
            suffix="ETH"
            value={filter.minEth ?? ""}
            error={minError}
            onChange={(e) => onChange({ ...filter, minEth: e.target.value })}
          />
          <Field
            label="Max price (ETH)"
            name="listing-max-price"
            inputMode="decimal"
            autoComplete="off"
            suffix="ETH"
            value={filter.maxEth ?? ""}
            error={maxError}
            onChange={(e) => onChange({ ...filter, maxEth: e.target.value })}
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold">Category</p>
          <ChipGroup
            mode="checkbox"
            label="Category"
            options={CATEGORY_OPTIONS}
            value={filter.categories}
            onChange={(next) => onChange({ ...filter, categories: next })}
          />
        </div>
        {isFilterActive(filter) ? (
          <div>
            <Button variant="ghost" onClick={() => onChange({ categories: [] })}>
              Clear filters
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
