import { describe, expect, it } from "vitest";
import { validateListingInput } from "./validate-listing";

const good = { title: " Groceries Q3 insights ", description: "Three weeks of bills.", priceEth: "0.05" };

function errorsOf(fields: Partial<typeof good>) {
  const result = validateListingInput({ ...good, ...fields });
  return result.ok ? null : result.errors;
}

describe("validateListingInput success", () => {
  it("trims the title and parses the price to wei", () => {
    const result = validateListingInput(good);
    expect(result).toEqual({
      ok: true,
      value: { title: "Groceries Q3 insights", description: "Three weeks of bills.", priceWei: 50000000000000000n },
    });
  });

  it("accepts the limits: 80-character title, 300-character description, 1 wei", () => {
    expect(errorsOf({ title: "t".repeat(80) })).toBeNull();
    expect(errorsOf({ description: "d".repeat(300) })).toBeNull();
    expect(errorsOf({ priceEth: "0.000000000000000001" })).toBeNull();
  });
});

describe("validateListingInput title", () => {
  const message = "Add a title (1 to 80 characters).";

  it("rejects a blank title", () => {
    expect(errorsOf({ title: "" })?.title).toBe(message);
    expect(errorsOf({ title: "   " })?.title).toBe(message);
  });

  it("rejects an 81-character title", () => {
    expect(errorsOf({ title: "t".repeat(81) })?.title).toBe(message);
  });
});

describe("validateListingInput description", () => {
  const message = "Add a short description (1 to 300 characters).";

  it("rejects a blank description", () => {
    expect(errorsOf({ description: "" })?.description).toBe(message);
    expect(errorsOf({ description: "  \n " })?.description).toBe(message);
  });

  it("rejects a 301-character description", () => {
    expect(errorsOf({ description: "d".repeat(301) })?.description).toBe(message);
  });
});

describe("validateListingInput price", () => {
  const message = "Enter a price greater than 0 ETH.";

  it("rejects zero, negative, non-numeric and empty prices", () => {
    for (const priceEth of ["0", "0.0", "-1", "abc", "", "  "]) {
      expect(errorsOf({ priceEth })?.price, priceEth).toBe(message);
    }
  });

  it("reports every invalid field at once and no value", () => {
    const result = validateListingInput({ title: "", description: "", priceEth: "0" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["description", "price", "title"]);
  });
});
