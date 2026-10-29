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
