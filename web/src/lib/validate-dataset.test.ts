import { describe, expect, it } from "vitest";
import { NAME_ERROR, NAME_MAX, validDatasetName } from "./validate-dataset";

describe("validDatasetName", () => {
  it("rejects an empty or blank name", () => {
    expect(validDatasetName("")).toBe(false);
    expect(validDatasetName("   ")).toBe(false);
  });

  it("accepts 1 and 60 characters after trimming", () => {
    expect(validDatasetName("a")).toBe(true);
    expect(validDatasetName("n".repeat(60))).toBe(true);
    expect(validDatasetName(`  ${"n".repeat(60)}  `)).toBe(true);
  });

  it("rejects 61 characters", () => {
    expect(validDatasetName("n".repeat(61))).toBe(false);
  });

  it("keeps the Phase 1 copy and limit", () => {
    expect(NAME_ERROR).toBe("Give your dataset a name (1 to 60 characters).");
    expect(NAME_MAX).toBe(60);
  });
});
