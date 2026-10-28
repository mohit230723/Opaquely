import { describe, expect, it } from "vitest";
import { dateInputToDays, todayInputValue, validateBillDraft, type BillFormFields } from "./validate-bill";

// 29 Oct 2026, midday local time, so the local calendar date is the 29th in every time zone.
const NOW = new Date(2026, 9, 29, 12, 0, 0);

const good: BillFormFields = { vendor: "Corner Store", amount: "1,234.50", date: "2026-10-01", category: 0 };

function errorsOf(fields: Partial<BillFormFields>) {
  const result = validateBillDraft({ ...good, ...fields }, NOW);
  return result.ok ? null : result.errors;
}

describe("validateBillDraft amount", () => {
  it("rejects zero and non-numbers with the same message", () => {
    expect(errorsOf({ amount: "0" })?.amount).toBe("Enter an amount greater than 0.");
    expect(errorsOf({ amount: "0.00" })?.amount).toBe("Enter an amount greater than 0.");
    expect(errorsOf({ amount: "abc" })?.amount).toBe("Enter an amount greater than 0.");
    expect(errorsOf({ amount: "" })?.amount).toBe("Enter an amount greater than 0.");
    expect(errorsOf({ amount: "-5" })?.amount).toBe("Enter an amount greater than 0.");
  });

  it("accepts a positive amount", () => {
    expect(errorsOf({ amount: "0.01" })).toBeNull();
  });
});

describe("validateBillDraft date", () => {
  const message = "Enter a valid date that is not in the future.";

  it("rejects impossible calendar dates and empty input", () => {
    expect(errorsOf({ date: "2026-02-30" })?.date).toBe(message);
    expect(errorsOf({ date: "2026-13-01" })?.date).toBe(message);
    expect(errorsOf({ date: "2026-00-10" })?.date).toBe(message);
    expect(errorsOf({ date: "" })?.date).toBe(message);
    expect(errorsOf({ date: "29/10/2026" })?.date).toBe(message);
  });

  it("accepts a real leap day and rejects a fake one", () => {
    expect(errorsOf({ date: "2024-02-29" })).toBeNull();
    expect(errorsOf({ date: "2026-02-29" })?.date).toBe(message);
  });

  it("rejects tomorrow but accepts today", () => {
    expect(errorsOf({ date: "2026-10-30" })?.date).toBe(message);
    expect(errorsOf({ date: "2026-10-29" })).toBeNull();
  });

  it("rejects dates before the Unix epoch", () => {
    expect(errorsOf({ date: "1969-12-31" })?.date).toBe(message);
  });
});

describe("validateBillDraft category", () => {
  it("requires one of the 6 categories", () => {
    expect(errorsOf({ category: null })?.category).toBe("Choose a category.");
    expect(errorsOf({ category: 6 })?.category).toBe("Choose a category.");
    expect(errorsOf({ category: -1 })?.category).toBe("Choose a category.");
    expect(errorsOf({ category: 2.5 })?.category).toBe("Choose a category.");
    expect(errorsOf({ category: 5 })).toBeNull();
  });
});

describe("validateBillDraft vendor", () => {
  it("is optional", () => {
    expect(errorsOf({ vendor: "" })).toBeNull();
  });

  it("rejects more than 80 characters", () => {
    expect(errorsOf({ vendor: "x".repeat(81) })?.vendor).toBeTruthy();
    expect(errorsOf({ vendor: "x".repeat(80) })).toBeNull();
  });
});

describe("validateBillDraft result", () => {
  it("returns the draft with cents, epoch days, category and a trimmed vendor", () => {
    const result = validateBillDraft({ vendor: "  Corner Store  ", amount: "1,234.50", date: "2026-10-01", category: 3 }, NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft).toEqual({ amountCents: 123450n, dateDays: 20727, category: 3, vendor: "Corner Store" });
    }
  });

  it("reports every invalid field at once", () => {
    const errors = errorsOf({ amount: "0", date: "", category: null });
    expect(Object.keys(errors ?? {}).sort()).toEqual(["amount", "category", "date"]);
  });
});

describe("dateInputToDays and todayInputValue", () => {
  it("counts days since the Unix epoch in UTC", () => {
    expect(dateInputToDays("1970-01-01")).toBe(0);
    expect(dateInputToDays("1970-01-02")).toBe(1);
    expect(dateInputToDays("2026-10-01")).toBe(20727);
  });

  it("returns null for a malformed or impossible date", () => {
    expect(dateInputToDays("2026-02-30")).toBeNull();
    expect(dateInputToDays("nope")).toBeNull();
  });

  it("formats the local calendar date", () => {
    expect(todayInputValue(NOW)).toBe("2026-10-29");
    expect(todayInputValue(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});
