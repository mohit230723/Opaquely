import { describe, expect, it } from "vitest";
import type { ActivityEvent, Hex } from "@/data/types";
import { describeActivity, sameAddress } from "./activity";
import { shortAddress } from "./format";

const ME = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as Hex;
const OTHER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as Hex;
const TX = ("0x" + "ab".repeat(32)) as Hex;

function event(partial: Partial<ActivityEvent>): ActivityEvent {
  return { id: "e1", kind: "listed", actor: ME, txHash: TX, at: 0, ...partial };
}

describe("sameAddress", () => {
  it("compares case-insensitively", () => {
    expect(sameAddress(ME, ME.toLowerCase())).toBe(true);
    expect(sameAddress(ME.toUpperCase().replace("0X", "0x"), ME)).toBe(true);
  });

  it("is false for different addresses", () => {
    expect(sameAddress(ME, OTHER)).toBe(false);
  });

  it("is false when either side is missing", () => {
    expect(sameAddress(undefined, ME)).toBe(false);
    expect(sameAddress(ME, undefined)).toBe(false);
    expect(sameAddress(undefined, undefined)).toBe(false);
    expect(sameAddress("", "")).toBe(false);
  });
});

describe("describeActivity", () => {
  it("says You for the connected address on a listing", () => {
    const e = event({ kind: "listed", actor: ME, title: "T", amountWei: 50000000000000000n });
    expect(describeActivity(e, ME)).toBe('You listed "T" for 0.05 ETH');
  });

  it("matches the connected address case-insensitively", () => {
    const e = event({ kind: "listed", actor: ME, title: "T", amountWei: 50000000000000000n });
    expect(describeActivity(e, ME.toLowerCase())).toBe('You listed "T" for 0.05 ETH');
  });

  it("uses the short address for another actor", () => {
    const e = event({ kind: "listed", actor: OTHER, title: "T", amountWei: 50000000000000000n });
    const text = describeActivity(e, ME);
    expect(text.startsWith(shortAddress(OTHER))).toBe(true);
    expect(text).toBe(`${shortAddress(OTHER)} listed "T" for 0.05 ETH`);
  });

  it("describes a purchase", () => {
    const e = event({ kind: "purchased", actor: OTHER, title: "T", amountWei: 50000000000000000n });
    expect(describeActivity(e, ME)).toBe(`${shortAddress(OTHER)} bought "T" for 0.05 ETH`);
    expect(describeActivity({ ...e, actor: ME }, ME)).toBe('You bought "T" for 0.05 ETH');
  });

  it("describes a withdrawal", () => {
    const e = event({ kind: "withdrawn", actor: ME, amountWei: 110000000000000000n });
    expect(describeActivity(e, ME)).toBe("You withdrew 0.11 ETH");
    expect(describeActivity({ ...e, actor: OTHER }, ME)).toBe(`${shortAddress(OTHER)} withdrew 0.11 ETH`);
  });

  it("falls back to a dataset when the title is missing", () => {
    const e = event({ kind: "purchased", actor: ME, amountWei: 10000000000000000n });
    expect(describeActivity(e, ME)).toBe("You bought a dataset for 0.01 ETH");
  });

  it("treats a missing amount as 0 ETH", () => {
    const e = event({ kind: "withdrawn", actor: ME });
    expect(describeActivity(e, ME)).toBe("You withdrew 0 ETH");
  });

  it("does not say You when nobody is connected", () => {
    const e = event({ kind: "listed", actor: ME, title: "T", amountWei: 1n });
    expect(describeActivity(e, undefined).startsWith("You")).toBe(false);
  });
});
