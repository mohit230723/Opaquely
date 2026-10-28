import { describe, expect, it } from "vitest";
import {
  formatBillAmount,
  formatDate,
  formatDateDays,
  formatEth,
  plural,
  relativeTime,
  shortAddress,
  shortHash,
} from "./format";

describe("shortAddress", () => {
  it("keeps the first 6 and last 4 characters", () => {
    expect(shortAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe("0x1234…5678");
  });
  it("leaves short input alone", () => {
    expect(shortAddress("0x12")).toBe("0x12");
  });
});

describe("shortHash", () => {
  it("keeps the first 10 and last 6 characters", () => {
    const h = "0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
    expect(shortHash(h)).toBe("0xabcdef01…456789");
  });
});

describe("formatEth", () => {
  it("formats zero", () => {
    expect(formatEth(0n)).toBe("0 ETH");
  });
  it("trims trailing zeros", () => {
    expect(formatEth(50000000000000000n)).toBe("0.05 ETH");
    expect(formatEth(1000000000000000000n)).toBe("1 ETH");
  });
  it("shows at most 6 decimals", () => {
    expect(formatEth(123456789012345678n)).toBe("0.123456 ETH");
  });
  it("does not lose precision on large values", () => {
    expect(formatEth(12345678901234567890123n)).toBe("12345.678901 ETH");
  });
});

describe("formatBillAmount", () => {
  it("formats cents with two decimals", () => {
    expect(formatBillAmount(123450n)).toBe("₹1,234.50");
    expect(formatBillAmount(5n)).toBe("₹0.05");
  });
  it("uses en-IN grouping", () => {
    expect(formatBillAmount(12345678n)).toBe("₹1,23,456.78");
  });
});

describe("dates", () => {
  it("formats a timestamp as day, short month, year in UTC", () => {
    expect(formatDate(Date.UTC(2026, 9, 30, 12))).toBe("30 Oct 2026");
  });
  it("formats days since the epoch", () => {
    expect(formatDateDays(20727)).toBe("1 Oct 2026");
  });
});

describe("relativeTime", () => {
  const now = Date.UTC(2026, 9, 30, 12);
  it("gives hours", () => {
    expect(relativeTime(now - 2 * 3_600_000, now)).toBe("2 hours ago");
  });
  it("gives minutes and days", () => {
    expect(relativeTime(now - 5 * 60_000, now)).toBe("5 minutes ago");
    expect(relativeTime(now - 3 * 86_400_000, now)).toBe("3 days ago");
  });
  it("gives just now under a minute", () => {
    expect(relativeTime(now - 10_000, now)).toBe("just now");
  });
});

describe("plural", () => {
  it("uses the singular for 1", () => {
    expect(plural(1, "bill")).toBe("1 bill");
  });
  it("adds s by default", () => {
    expect(plural(3, "bill")).toBe("3 bills");
    expect(plural(0, "sale")).toBe("0 sales");
  });
  it("accepts an explicit plural", () => {
    expect(plural(2, "category", "categories")).toBe("2 categories");
  });
});
