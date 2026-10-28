import { beforeEach, describe, expect, it } from "vitest";
import { clearSessionBills, getSessionBills, recordSessionBill, subscribeSessionBills } from "./session-bills";
import type { BillDraft } from "@/data/types";

const A = "0xF39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const B = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

function draft(vendor: string, cents = 100n): BillDraft {
  return { amountCents: cents, dateDays: 20000, category: 1, vendor };
}

beforeEach(() => {
  clearSessionBills();
});

describe("session bills", () => {
  it("returns what was recorded", () => {
    recordSessionBill(A, "ds", { index: 0, draft: draft("Corner Store") });
    expect(getSessionBills(A, "ds")).toEqual([{ index: 0, draft: draft("Corner Store") }]);
  });

  it("returns an empty list when nothing was recorded", () => {
    expect(getSessionBills(A, "ds")).toEqual([]);
  });

  it("sorts entries by index", () => {
    recordSessionBill(A, "ds", { index: 2, draft: draft("c") });
    recordSessionBill(A, "ds", { index: 0, draft: draft("a") });
    recordSessionBill(A, "ds", { index: 1, draft: draft("b") });
    expect(getSessionBills(A, "ds").map((r) => r.index)).toEqual([0, 1, 2]);
  });

  it("keeps wallets and datasets apart, matching addresses case-insensitively", () => {
    recordSessionBill(A, "ds", { index: 0, draft: draft("a") });
    expect(getSessionBills(B, "ds")).toEqual([]);
    expect(getSessionBills(A, "other")).toEqual([]);
    expect(getSessionBills(A.toLowerCase(), "ds")).toHaveLength(1);
  });

  it("keeps the same array reference until a new entry is recorded for that key", () => {
    recordSessionBill(A, "ds", { index: 0, draft: draft("a") });
    const first = getSessionBills(A, "ds");
    expect(getSessionBills(A, "ds")).toBe(first);
    recordSessionBill(B, "ds", { index: 0, draft: draft("b") });
    expect(getSessionBills(A, "ds")).toBe(first);
    recordSessionBill(A, "ds", { index: 1, draft: draft("c") });
    expect(getSessionBills(A, "ds")).not.toBe(first);
    expect(getSessionBills(A, "ds")).toHaveLength(2);
  });

  it("replaces an entry recorded twice for the same index", () => {
    recordSessionBill(A, "ds", { index: 0, draft: draft("old") });
    recordSessionBill(A, "ds", { index: 0, draft: draft("new") });
    expect(getSessionBills(A, "ds")).toHaveLength(1);
    expect(getSessionBills(A, "ds")[0].draft.vendor).toBe("new");
  });

  it("notifies subscribers on record and empties everything on clear", () => {
    let calls = 0;
    const unsubscribe = subscribeSessionBills(() => {
      calls += 1;
    });
    recordSessionBill(A, "ds", { index: 0, draft: draft("a") });
    expect(calls).toBe(1);
    clearSessionBills();
    expect(calls).toBe(2);
    expect(getSessionBills(A, "ds")).toEqual([]);
    unsubscribe();
    recordSessionBill(A, "ds", { index: 0, draft: draft("a") });
    expect(calls).toBe(2);
  });
});
