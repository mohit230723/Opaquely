import type { ActivityEvent, Dataset, Purchase } from "@/data/types";
import { sameAddress } from "./activity";

// Per-wallet figures for My Datasets and My Account, derived from reads that already exist (no DataLayer
// change). The figures are display-only: payouts and access stay on-chain.

export interface ListingSales {
  /** Number of purchases of the listing (one per buyer: the contract rejects a second purchase). */
  count: number;
  /** Sum of what those purchases paid. */
  totalWei: bigint;
}

export interface SalesSummary {
  perListing: ReadonlyMap<string, ListingSales>;
  totalEarnedWei: bigint;
  totalWithdrawnWei: bigint;
  totalSpentWei: bigint;
  /** My listings, my purchases, purchases of my listings and my withdrawals, in input order (newest first). */
  myHistory: ActivityEvent[];
}

export interface DeriveSalesInput {
  /** The connected wallet. undefined gives an empty summary. */
  me: string | undefined;
  /** Listing ids this wallet owns (myListingIdsOf over useMyDatasets). */
  myListingIds: ReadonlySet<string>;
  /** Every marketplace event (useActivity), newest first. */
  events: readonly ActivityEvent[];
  /** This wallet's purchases (useMyPurchases). */
  purchases: readonly Purchase[];
}

/** The listing id of every dataset that has been listed. */
export function myListingIdsOf(datasets: readonly Dataset[]): Set<string> {
  const ids = new Set<string>();
  for (const d of datasets) if (d.listingId !== undefined) ids.add(d.listingId);
  return ids;
}

/**
 * Sales are attributed by listing id membership only (a purchase event's actor is the buyer, so it never names
 * the seller). Withdrawals count when this wallet is the actor. Addresses compare case-insensitively.
 */
export function deriveSales({ me, myListingIds, events, purchases }: DeriveSalesInput): SalesSummary {
  const perListing = new Map<string, ListingSales>();
  if (!me) {
    return { perListing, totalEarnedWei: 0n, totalWithdrawnWei: 0n, totalSpentWei: 0n, myHistory: [] };
  }

  let totalEarnedWei = 0n;
  let totalWithdrawnWei = 0n;
  const myHistory: ActivityEvent[] = [];

  for (const e of events) {
    const amount = e.amountWei ?? 0n;
    const saleOfMine = e.kind === "purchased" && e.listingId !== undefined && myListingIds.has(e.listingId);
    const byMe = sameAddress(e.actor, me);

    if (saleOfMine && e.listingId !== undefined) {
      const prev = perListing.get(e.listingId) ?? { count: 0, totalWei: 0n };
      perListing.set(e.listingId, { count: prev.count + 1, totalWei: prev.totalWei + amount });
      totalEarnedWei += amount;
    }
    if (e.kind === "withdrawn" && byMe) totalWithdrawnWei += amount;
    if (byMe || saleOfMine) myHistory.push(e);
  }

  const totalSpentWei = purchases.reduce((sum, p) => sum + p.priceWei, 0n);
  return { perListing, totalEarnedWei, totalWithdrawnWei, totalSpentWei, myHistory };
}
