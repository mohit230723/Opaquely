import { describe, expect, it } from "vitest";
import { findDate, findTotalCents, findVendor, parseReceiptText, suggestCategory } from "./parse-receipt";
import { OCR_FIXTURES } from "./parse-receipt.fixtures";

const TODAY = "2026-10-29";

describe("the three bundled sample bills (real OCR output)", () => {
  it("grocery: the labelled grand total beats the larger cash tendered", () => {
    expect(parseReceiptText(OCR_FIXTURES.grocery, TODAY)).toEqual({
      amount: "1507.80",
      amountCents: 150780n,
      date: "2026-10-18",
      vendor: "SHREE GANESH SUPER MART",
      category: 1,
    });
  });

  it("electricity: Total Amount Due, the bill date and not the due date or the billing period", () => {
    expect(parseReceiptText(OCR_FIXTURES.electricity, TODAY)).toEqual({
      amount: "3322.40",
      amountCents: 332240n,
      date: "2026-10-12",
      vendor: "Bright Power Distribution Co. Ltd.",
      category: 0,
    });
  });

  it("pharmacy: Net Amount Payable beats the larger 6,500.00 line item", () => {
    expect(parseReceiptText(OCR_FIXTURES.pharmacy, TODAY)).toEqual({
      amount: "8345.50",
      amountCents: 834550n,
      date: "2026-10-25",
      vendor: "CityCare Pharmacy",
      category: 2,
    });
  });
});

describe("findTotalCents", () => {
  it.each([
    ["Total Amount Due Rs. 3,322.40", 332240n],
    ["TOTAL 1,24,580.00", 12458000n], // Indian grouping
    ["Grand Total: ₹ 12,34,567.50", 123456750n],
    ["Total 1500", 150000n], // a bare integer on a total line
    ["Amount Due INR 2,500", 250000n],
    ["Total Amount Due\nRs. 3,322.40", 332240n], // label and value on two lines
    ["Sub Total 1,436.00\nGST 71.80\nGRAND TOTAL 1,507.80", 150780n],
    ["Item A 10.00\nItem B 250.75\nCASH 500.00\nCHANGE 239.25", 25075n], // no label: largest, minus tender lines
    ["Total 12,50", 1250n], // decimal comma, read the same way money.ts reads it
  ])("%j gives %s cents", (text, cents) => {
    expect(findTotalCents(text)).toBe(cents);
  });

  it("ignores total-items, total-qty and total-tax lines", () => {
    expect(findTotalCents("Total Items 9\nTotal Qty 12\nTotal Tax 18.00\nTotal 450.00")).toBe(45000n);
    expect(findTotalCents("Total Items 9.00")).toBeNull();
  });

  it("returns null for text with no money", () => {
    expect(findTotalCents("")).toBeNull();
    expect(findTotalCents("Thank you\nVisit again 2026")).toBeNull();
  });

  it("never goes through floating point", () => {
    expect(findTotalCents("Total 1.15")).toBe(115n);
    expect(findTotalCents("Total 0.07")).toBe(7n);
    expect(findTotalCents("Total 999999999.99")).toBe(99999999999n);
  });
});

describe("findDate", () => {
  it.each([
    ["Date: 18/10/2026", "2026-10-18"],
    ["Date : 25-10-2026", "2026-10-25"],
    ["Bill Date: 12 Oct 2026", "2026-10-12"],
    ["Dated 3rd October, 2026", "2026-10-03"],
    ["Oct 5, 2026", "2026-10-05"],
    ["2026-10-07", "2026-10-07"],
    ["07.10.26", "2026-10-07"], // two-digit year
    ["Date: 10/25/2026", "2026-10-25"], // month first only when the second number is above 12
    ["Date: 05/06/2026", "2026-06-05"], // ambiguous: day first
  ])("%j gives %s", (text, date) => {
    expect(findDate(text, TODAY)).toBe(date);
  });

  it("prefers a labelled bill date over due and period dates, in any line order", () => {
    const text = "Due Date: 27 Oct 2026\nBilling Period: 01 Sep - 30 Sep 2026\nBill Date: 12 Oct 2026";
    expect(findDate(text, TODAY)).toBe("2026-10-12");
  });

  it("rejects future dates, impossible dates and pre-2000 years", () => {
    expect(findDate("Date: 30/10/2026", TODAY)).toBe("");
    expect(findDate("Date: 31/02/2026", TODAY)).toBe("");
    expect(findDate("Date: 01/01/1999", TODAY)).toBe("");
    expect(findDate("no date here 18:42", TODAY)).toBe("");
  });
});

describe("findVendor", () => {
  it("takes the first name-like line and skips labels, numbers and noise", () => {
    expect(findVendor("TAX INVOICE\n\n  *** \n12345 6789\nSunrise Fuel Station\nPump 4")).toBe("Sunrise Fuel Station");
    expect(findVendor("Welcome\nGSTIN 27ABCDE1234F1Z5\nQuick Bite Cafe")).toBe("Quick Bite Cafe");
  });
  it("clamps to the 80 character vendor limit and handles empty text", () => {
    expect(findVendor("A".repeat(200)).length).toBe(80);
    expect(findVendor("")).toBe("");
    expect(findVendor("12 34\n-- --")).toBe("");
  });
});

describe("suggestCategory", () => {
  it.each([
    ["Indian Oil Petrol Pump\nPetrol 24.5 L", "Indian Oil Petrol Pump", 3],
    ["Fashion Hub\nApparel\nShirt", "Fashion Hub", 4],
    ["Water bill supply\nUnits", "City Water", 0],
    ["Totally unrelated words", "Zzz", null],
  ])("suggests for %j", (text, vendor, id) => {
    expect(suggestCategory(text, vendor)).toBe(id);
  });
});
