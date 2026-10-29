import { describe, expect, it } from "vitest";
import { parseAmountToCents } from "./money";

describe("parseAmountToCents", () => {
  it.each([
    ["1,234.5", 123450n],
    ["1,23,456.78", 12345678n],
    [" 42 ", 4200n],
    ["0", 0n],
    ["0.00", 0n],
    ["0.5", 50n],
    ["7.05", 705n],
    ["19.99", 1999n],
    ["999999999999.99", 99999999999999n],
    ["1,234", 123400n],
    ["12,34,567", 123456700n],
    ["1,234,567.89", 123456789n],
  ])("parses %j to %s cents", (input, cents) => {
    expect(parseAmountToCents(input)).toBe(cents);
  });

  it.each([
    ["12,50", 1250n],
    ["0,5", 50n],
    ["7,05", 705n],
    ["1,00", 100n],
    [" 1234,5 ", 123450n],
  ])("reads a trailing comma and one or two digits as a decimal comma: %j to %s cents", (input, cents) => {
    expect(parseAmountToCents(input)).toBe(cents);
  });

  it.each(["1,2,3", ",,5", ",5", "5,", "1,50.00", "1,2.50", "1,234,56", "1,23,4,567", "12,3456", "1.234,56", "1,,234"])(
    "rejects ambiguous or junk comma placement %j",
    (input) => {
      expect(parseAmountToCents(input)).toBeNull();
    },
  );

  it.each(["abc", "", "   ", "-5", "1e3", "1.234", "12.3.4", ".5", "5.", "1 000", "9999999999999"])(
    "rejects %j",
    (input) => {
      expect(parseAmountToCents(input)).toBeNull();
    },
  );

  it("stays exact where float multiplication would drift", () => {
    expect(parseAmountToCents("1.15")).toBe(115n);
    expect(parseAmountToCents("4.35")).toBe(435n);
    expect(parseAmountToCents("8.2")).toBe(820n);
  });
});
