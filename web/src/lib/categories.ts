// Bill categories, single source. Names are REQUIREMENTS COMP-01 verbatim. The id order is an
// assumption until Phase 3 fixes the contract ids; every screen reads this table, never literals.
export const CATEGORIES = [
  { id: 0, key: "utilities", label: "Utilities" },
  { id: 1, key: "groceries", label: "Groceries/Food" },
  { id: 2, key: "medical", label: "Medical" },
  { id: 3, key: "transport", label: "Transport/Fuel" },
  { id: 4, key: "shopping", label: "Shopping" },
  { id: 5, key: "other", label: "Other" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export function isCategoryId(n: number): n is CategoryId {
  return Number.isInteger(n) && n >= 0 && n < CATEGORIES.length;
}

export function categoryLabel(id: number): string {
  return isCategoryId(id) ? CATEGORIES[id].label : "Unknown";
}
