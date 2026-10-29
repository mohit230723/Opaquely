import { describe, expect, it } from "vitest";
import { isEmptyParse, mergePrefill } from "./prefill";
import type { BillFormFields } from "./validate-bill";

const EMPTY: BillFormFields = { vendor: "", amount: "", date: "", category: null };
const A: BillFormFields = { vendor: "Shop A", amount: "100.00", date: "2026-10-01", category: 1 };
const B: BillFormFields = { vendor: "Shop B", amount: "250.00", date: "2026-10-02", category: 2 };

describe("mergePrefill (WR-03)", () => {
  it("fills an empty form", () => {
    const m = mergePrefill(EMPTY, A, EMPTY);
    expect(m.fields).toEqual(A);
    expect(m.applied).toEqual(A);
  });

  it("keeps what the seller typed and fills the rest", () => {
    const typed = { ...EMPTY, amount: "999.00", category: 4 };
    const m = mergePrefill(typed, A, EMPTY);
    expect(m.fields).toEqual({ vendor: "Shop A", amount: "999.00", date: "2026-10-01", category: 4 });
    expect(m.applied.amount).toBe(""); // not ours, so a later suggestion may not take it over either
  });

  it("lets a second image replace fields the first image filled and the seller never touched", () => {
    const first = mergePrefill(EMPTY, A, EMPTY);
    const second = mergePrefill(first.fields, B, first.applied);
    expect(second.fields).toEqual(B);
  });

  it("keeps a field the seller edited after the first image", () => {
    const first = mergePrefill(EMPTY, A, EMPTY);
    const edited = { ...first.fields, amount: "8,300.00" };
    const second = mergePrefill(edited, B, first.applied);
    expect(second.fields).toEqual({ ...B, amount: "8,300.00" });
  });

  it("clears an untouched suggested field when the next image has no value for it", () => {
    const first = mergePrefill(EMPTY, A, EMPTY);
    const second = mergePrefill(first.fields, { ...B, date: "" }, first.applied);
    expect(second.fields.date).toBe("");
  });

  it("treats a cleared field as empty again", () => {
    const m = mergePrefill({ ...EMPTY, vendor: "   " }, A, EMPTY);
    expect(m.fields.vendor).toBe("Shop A");
  });
});

describe("isEmptyParse", () => {
  it("is true with no amount, date or category, whatever the vendor says", () => {
    expect(isEmptyParse({ amount: "", date: "", category: null })).toBe(true);
  });
  it("is false when any of the three was found", () => {
    expect(isEmptyParse({ amount: "1.00", date: "", category: null })).toBe(false);
    expect(isEmptyParse({ amount: "", date: "2026-10-01", category: null })).toBe(false);
    expect(isEmptyParse({ amount: "", date: "", category: 0 })).toBe(false);
  });
});
