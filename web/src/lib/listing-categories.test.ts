import { describe, expect, it } from "vitest";
import { categoriesDisclosure } from "./listing-categories";

describe("categoriesDisclosure (WR-06)", () => {
  it("names the categories buyers will see when the tab holds every bill", () => {
    const d = categoriesDisclosure("chain", [0, 1]);
    expect(d.known).toBe(true);
    expect(d.text).toBe("Buyers will see these categories: Utilities, Groceries/Food.");
  });

  it("warns that categories will be omitted when the tab no longer holds the bills", () => {
    const d = categoriesDisclosure("chain", []);
    expect(d.known).toBe(false);
    expect(d.text).toBe("Categories will not be shown to buyers because this tab no longer holds the bill details.");
  });

  it("keeps the simulated layer's wording", () => {
    expect(categoriesDisclosure("stub", []).text).toContain("The listing also shows buyers which categories");
  });
});
