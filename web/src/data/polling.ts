// Which queries refetch on a timer. The demo runs a seller and a buyer in two browser profiles, and without
// polling neither would see the other's listing, sale or withdrawal until it navigates. Reads are local
// eth_calls, so a 4 s cadence costs nothing. On Sepolia (key[3] === "11155111", keys.ts stores the chain id as a
// string) reads go to a public RPC and a block lasts 12 s, so they poll every 12 s instead (PD-27).
// Rules: only chain reads (key[1] === "chain") and only the seven reads another wallet's transaction can change.
// The stub never polls because nothing outside the tab changes it. wagmi's own queries have an object, not
// "chain", as their second key element, so they never match. `dataset` and `chain-view` are the seller's own
// state and refresh through the write hooks' invalidations.
// Key layout (data/keys.ts): [name, scope.source, address-or-"none", chainId, ...ids].

import { SEPOLIA_CHAIN_ID } from "@/lib/constants";

export const CHAIN_POLL_MS = 4000;
export const SEPOLIA_POLL_MS = 12_000;

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
  if (queryKey[1] !== "chain" || typeof name !== "string" || !POLLED_READS.has(name)) return false;
  return queryKey[3] === String(SEPOLIA_CHAIN_ID) ? SEPOLIA_POLL_MS : CHAIN_POLL_MS;
}
