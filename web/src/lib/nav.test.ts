import { describe, expect, it } from "vitest";
import { NAV, activeIndex } from "./nav";

describe("NAV", () => {
  it("lists the four sections in header order", () => {
    expect(NAV.map((i) => i.label)).toEqual(["Upload", "Marketplace", "My Datasets", "My Account"]);
    expect(NAV.map((i) => i.href)).toEqual(["/upload", "/marketplace", "/my-datasets", "/account"]);
  });
});

describe("activeIndex", () => {
  it("matches each item exactly", () => {
    NAV.forEach((item, i) => expect(activeIndex(item.href)).toBe(i));
  });
  it("keeps Marketplace active on a nested listing path", () => {
    expect(activeIndex("/marketplace/listing-abc")).toBe(1);
  });
  it("has no active item on home, the FHE dev page or unknown paths", () => {
    expect(activeIndex("/")).toBe(-1);
    expect(activeIndex("/dev/fhe")).toBe(-1);
    expect(activeIndex("/nope")).toBe(-1);
  });
  it("does not match a near-miss prefix", () => {
    expect(activeIndex("/marketplacex")).toBe(-1);
    expect(activeIndex("/uploads")).toBe(-1);
  });
});
