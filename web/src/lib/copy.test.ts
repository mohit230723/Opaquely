import { describe, expect, it } from "vitest";
import {
  BUYER_CAN_DECRYPT,
  BUYER_GETS,
  BUYER_NOT_GETS,
  BUYER_PROMISE,
  CATEGORIES_NOT_DECLARED,
  CATEGORIES_SELLER_DECLARED,
  DECRYPT_COMING_LABEL,
  DECRYPT_HELPER,
} from "./copy";

describe("buyer copy", () => {
  it("states the promise exactly", () => {
    expect(BUYER_PROMISE).toBe("You get encrypted aggregate insights, not raw bills. One-time, permanent access.");
  });

  it("keeps both ROADMAP phrases, case-insensitively", () => {
    const lower = BUYER_PROMISE.toLowerCase();
    expect(lower).toContain("encrypted aggregate insights, not raw bills");
    expect(lower).toContain("one-time, permanent access");
  });

  it("lists what the buyer gets and does not get", () => {
    expect(BUYER_GETS).toEqual(["6 category totals", "Grand total", "Record count", "Anomaly count"]);
    expect(BUYER_NOT_GETS).toEqual(["Raw bills", "Vendor names", "Per-bill values"]);
  });

  it("pins what a purchase unlocks and the seller-declared category copy", () => {
    expect(BUYER_CAN_DECRYPT).toBe("You can decrypt: 6 category totals, 1 anomaly count, grand total.");
    expect(CATEGORIES_NOT_DECLARED).toBe("Categories not declared by the seller");
    expect(CATEGORIES_SELLER_DECLARED).toBe("Categories are declared by the seller and not verified.");
  });

  it("labels the decrypt action as coming in M2", () => {
    expect(DECRYPT_COMING_LABEL).toBe("Decrypt insights (coming in M2)");
    expect(DECRYPT_HELPER).toBe("Decryption arrives in Milestone 2.");
  });
});
