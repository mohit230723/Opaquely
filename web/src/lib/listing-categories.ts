import { categoryLabel } from "./categories";

/**
 * What the list dialog tells the seller about categories before sealing. On the chain the listing's
 * categories come only from bills this tab holds in memory, and sealing cannot be undone, so the
 * seller must know up front whether buyers will see any. `declared` is declaredCategories(...).
 */
export function categoriesDisclosure(source: "stub" | "chain", declared: readonly number[]): { known: boolean; text: string } {
  if (source === "stub") {
    return {
      known: true,
      text: "The listing also shows buyers which categories these bills cover, taken from the bills you added in this browser session.",
    };
  }
  if (declared.length === 0) {
    return {
      known: false,
      text: "Categories will not be shown to buyers because this tab no longer holds the bill details.",
    };
  }
  return { known: true, text: `Buyers will see these categories: ${declared.map(categoryLabel).join(", ")}.` };
}
