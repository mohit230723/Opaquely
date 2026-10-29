// Buyer-facing promises, one source. The detail page, the purchase dialog and (in plan 01-11) the
// purchases screen read these, so the wording cannot drift between screens.

/** MKT-04: what a purchase gives. Keeps both ROADMAP phrases verbatim so a test can grep them. */
export const BUYER_PROMISE = "You get encrypted aggregate insights, not raw bills. One-time, permanent access.";

/** What the buyer receives. Aggregates only. */
export const BUYER_GETS = ["6 category totals", "Grand total", "Record count", "Anomaly count"] as const;

/** What the buyer never receives. */
export const BUYER_NOT_GETS = ["Raw bills", "Vendor names", "Per-bill values"] as const;

/** Decrypting insights arrives in Milestone 2, so the action stays disabled and says so. */
export const DECRYPT_COMING_LABEL = "Decrypt insights (coming in M2)";
export const DECRYPT_HELPER = "Decryption arrives in Milestone 2.";

/**
 * What a purchase unlocks once decryption ships in Milestone 2. It names aggregates, never numbers.
 * "Record count" is in BUYER_GETS but deliberately not listed here: it is public on every listing
 * (Listing.recordCount), so it is not an encrypted insight the buyer decrypts.
 * The minimum bill count must not be described to buyers as a privacy guarantee (contracts/README.md, WR-01).
 */
export const BUYER_CAN_DECRYPT = "You can decrypt: 6 category totals, 1 anomaly count, grand total.";

/** A listing whose seller-declared category mask is 0. */
export const CATEGORIES_NOT_DECLARED = "Categories not declared by the seller";

/** The mask is public and unverified (contracts/README.md "Privacy notes"). */
export const CATEGORIES_SELLER_DECLARED = "Categories are declared by the seller and not verified.";
