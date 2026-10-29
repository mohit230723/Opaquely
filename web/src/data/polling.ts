// Which queries refetch on a timer. The demo runs a seller and a buyer in two browser profiles, and without
// polling neither would see the other's listing, sale or withdrawal until it navigates. Reads are local
// eth_calls, so a 4 s cadence costs nothing.
// Rules: only chain reads (key[1] === "chain") and only the seven reads another wallet's transaction can change.
// The stub never polls because nothing outside the tab changes it. wagmi's own queries have an object, not
// "chain", as their second key element, so they never match. `dataset` and `chain-view` are the seller's own
// state and refresh through the write hooks' invalidations.
// Key layout (data/keys.ts): [name, scope.source, address-or-"none", chainId, ...ids].

export const CHAIN_POLL_MS = 4000;

const POLLED_READS: ReadonlySet<string> = new Set([
  "my-datasets",
  "seller-stats",
  "listings",
  "listing",
  "has-access",
  "my-purchases",
  "activity",
]);

export function chainPollInterval(queryKey: readonly unknown[]): number | false {
  const name = queryKey[0];
  return queryKey[1] === "chain" && typeof name === "string" && POLLED_READS.has(name) ? CHAIN_POLL_MS : false;
}
