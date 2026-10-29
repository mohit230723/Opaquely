import { describe, expect, it } from "vitest";
import type { Hex, Listing, ListingFilter } from "@/data/types";
import { applyListingFilter, isFilterActive, parseEthInput } from "./filter-listings";

const SELLER_A = "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc" as Hex;
const SELLER_B = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as Hex;

function listing(id: string, title: string, priceEth: bigint, categories: number[], seller: Hex = SELLER_B): Listing {
  return {
    id,
    datasetId: `d-${id}`,
    seller,
    title,
    description: "",
    priceWei: priceEth,
    recordCount: 3,
    categories,
    listedAt: 0,
  };
}

const E = 10n ** 18n;
const LISTINGS: Listing[] = [
  listing("a", "Household utilities", E / 50n, [0]), // 0.02
  listing("b", "Weekly groceries from 40 families", E / 20n, [1], SELLER_A), // 0.05
  listing("c", "Pharmacy and clinic", (E * 8n) / 100n, [2]), // 0.08
  listing("d", "Fuel and rides", E / 100n, [3]), // 0.01
  listing("e", "Big shopping basket", E / 4n, [4, 5]), // 0.25
];

const none: ListingFilter = { categories: [] };

describe("parseEthInput", () => {
  it("treats an empty box as no bound", () => {
    expect(parseEthInput("")).toEqual({});
    expect(parseEthInput("   ")).toEqual({});
  });

  it("parses a decimal to wei without floats", () => {
    expect(parseEthInput("0.05")).toEqual({ value: 50000000000000000n });
    expect(parseEthInput("1")).toEqual({ value: 10n ** 18n });
    expect(parseEthInput(".5")).toEqual({ value: 5n * 10n ** 17n });
  });

  it("rejects text, negatives and malformed decimals", () => {
    const bad = { error: "Enter a valid ETH amount." };
    expect(parseEthInput("abc")).toEqual(bad);
    expect(parseEthInput("-1")).toEqual(bad);
    expect(parseEthInput("1..2")).toEqual(bad);
    expect(parseEthInput("1e18")).toEqual(bad);
  });
});

describe("applyListingFilter", () => {
  it("returns every listing in order for an empty filter", () => {
    expect(applyListingFilter(LISTINGS, none).map((l) => l.id)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("keeps listings containing a selected category", () => {
    expect(applyListingFilter(LISTINGS, { categories: [1] }).map((l) => l.id)).toEqual(["b"]);
  });

  it("matches any of several categories", () => {
    expect(applyListingFilter(LISTINGS, { categories: [1, 3] }).map((l) => l.id)).toEqual(["b", "d"]);
    expect(applyListingFilter(LISTINGS, { categories: [5] }).map((l) => l.id)).toEqual(["e"]);
  });

  it("minEth is inclusive", () => {
    expect(applyListingFilter(LISTINGS, { ...none, minEth: "0.05" }).map((l) => l.id)).toEqual(["b", "c", "e"]);
  });

  it("maxEth is inclusive", () => {
    expect(applyListingFilter(LISTINGS, { ...none, maxEth: "0.05" }).map((l) => l.id)).toEqual(["a", "b", "d"]);
  });

  it("ignores an invalid bound instead of emptying the list", () => {
    expect(applyListingFilter(LISTINGS, { ...none, minEth: "abc" })).toHaveLength(5);
    expect(applyListingFilter(LISTINGS, { ...none, maxEth: "-1" })).toHaveLength(5);
  });

  it("matches the title case-insensitively", () => {
    expect(applyListingFilter(LISTINGS, { ...none, query: "GROCERIES" }).map((l) => l.id)).toEqual(["b"]);
  });

  it("matches a seller address substring, case-insensitively", () => {
    expect(applyListingFilter(LISTINGS, { ...none, query: "0x9965" }).map((l) => l.id)).toEqual(["b"]);
    expect(applyListingFilter(LISTINGS, { ...none, query: "0X9965" }).map((l) => l.id)).toEqual(["b"]);
  });

  it("trims the query and treats blank as no query", () => {
    expect(applyListingFilter(LISTINGS, { ...none, query: "   " })).toHaveLength(5);
    expect(applyListingFilter(LISTINGS, { ...none, query: "  fuel " }).map((l) => l.id)).toEqual(["d"]);
  });

  it("combines fields with AND", () => {
    expect(
      applyListingFilter(LISTINGS, { categories: [0, 1, 2], minEth: "0.05", maxEth: "0.08", query: "pharmacy" }).map(
        (l) => l.id,
      ),
    ).toEqual(["c"]);
    expect(applyListingFilter(LISTINGS, { categories: [1], query: "utilities" })).toEqual([]);
  });

  it("does not mutate its input", () => {
    const copy = [...LISTINGS];
    applyListingFilter(LISTINGS, { categories: [1] });
    expect(LISTINGS).toEqual(copy);
  });
});

describe("isFilterActive", () => {
  it("is false for an empty filter", () => {
    expect(isFilterActive(none)).toBe(false);
    expect(isFilterActive({ categories: [], minEth: "", maxEth: "", query: "  " })).toBe(false);
  });

  it("is true when any field is set", () => {
    expect(isFilterActive({ categories: [2] })).toBe(true);
    expect(isFilterActive({ ...none, minEth: "0.1" })).toBe(true);
    expect(isFilterActive({ ...none, maxEth: "abc" })).toBe(true);
    expect(isFilterActive({ ...none, query: "x" })).toBe(true);
  });
});
