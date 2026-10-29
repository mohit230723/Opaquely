import { parseEther } from "viem";
import type { ActivityEvent, Dataset, Hex, Listing, Purchase } from "../types";

// Pure seed builders for the stub marketplace. Fixed timestamps (no Date.now), fixed ids, fixed
// prices: later plans assert filter results that depend on these exact values.

const DAY_MS = 24 * 60 * 60 * 1000;
// Well before any demo day (the demo is 30 Oct 2026), so no seeded or newly written event is ever
// stamped in the future and the timeline never says "in N hours".
export const SEED_BASE = Date.UTC(2026, 8, 1, 9, 0, 0); // 1 Sep 2026
/** After every seeded timestamp, so anything written while the demo runs sorts first. */
export const SEED_END = SEED_BASE + 10 * DAY_MS;

// ---- deterministic hex ----

function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** "0x" plus 64 hex characters derived only from the seed text (eight FNV-1a words). */
export function hex64(seed: string): Hex {
  let out = "";
  for (let i = 0; i < 8; i++) out += fnv1a(`${seed}#${i}`).toString(16).padStart(8, "0");
  return `0x${out}` as Hex;
}

export type HandleField = "amount" | "category" | "date";

/** The ciphertext handle the chain view shows for one field of one bill. */
export function handleFor(owner: string, datasetId: string, index: number, field: HandleField): Hex {
  return hex64(`handle|${owner.toLowerCase()}|${datasetId}|${index}|${field}`);
}

// ---- global demo listings ----

// Public Hardhat dev accounts that are not the e2e accounts.
export const DEV_SELLER_A = "0x90F79bf6EB2c4f870365E785982E1f101E93b906" as Hex;
export const DEV_SELLER_B = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65" as Hex;
export const DEV_SELLER_C = "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc" as Hex;

export const LONG_TITLE = "Shopping and other household receipts from Pune and Mumbai, Q1-Q3 2026";
export const LONG_DESCRIPTION =
  "Thirty anonymised receipts covering clothing, electronics, home goods and small one-off purchases from online and in-store retailers across two cities. Only encrypted amounts, dates and categories are stored onchain, so buyers get aggregate spend insights, not the original bills.";

export const GROCERIES_LISTING_ID = "listing-weekly-groceries";

export function seedGlobalListings(): Listing[] {
  return [
    {
      id: "listing-bengaluru-utilities",
      datasetId: "bengaluru-utilities-q3",
      seller: DEV_SELLER_A,
      title: "Bengaluru household utilities, Q3 2026",
      description: "Electricity, water and broadband bills from twelve Bengaluru households, July to September.",
      priceWei: parseEther("0.02"),
      recordCount: 12,
      categories: [0],
      listedAt: SEED_BASE + 1 * DAY_MS,
    },
    {
      id: GROCERIES_LISTING_ID,
      datasetId: "weekly-groceries",
      seller: DEV_SELLER_B,
      title: "Weekly groceries from 40 families",
      description: "Forty weekly grocery receipts from forty different families, supermarket and local store mixed.",
      priceWei: parseEther("0.05"),
      recordCount: 40,
      categories: [1],
      listedAt: SEED_BASE + 2 * DAY_MS,
    },
    {
      id: "listing-pharmacy-clinic",
      datasetId: "pharmacy-and-clinic",
      seller: DEV_SELLER_C,
      title: "Pharmacy and clinic visits",
      description: "Eighteen pharmacy and clinic receipts, with the vendor names kept off the chain.",
      priceWei: parseEther("0.08"),
      recordCount: 18,
      categories: [2],
      listedAt: SEED_BASE + 3 * DAY_MS,
    },
    {
      id: "listing-fuel-rides",
      datasetId: "fuel-and-rides",
      seller: DEV_SELLER_A,
      title: "Fuel and ride-hailing receipts",
      description: "Twenty-five fuel station and ride-hailing receipts from daily commuters.",
      priceWei: parseEther("0.01"),
      recordCount: 25,
      categories: [3],
      listedAt: SEED_BASE + 4 * DAY_MS,
    },
    {
      id: "listing-long-overflow",
      datasetId: "shopping-and-other",
      seller: DEV_SELLER_B,
      title: LONG_TITLE,
      description: LONG_DESCRIPTION,
      priceWei: parseEther("0.25"),
      recordCount: 30,
      categories: [4, 5],
      listedAt: SEED_BASE + 5 * DAY_MS,
    },
  ];
}

/** Listed events for the global listings. */
export function seedGlobalActivity(listings: Listing[]): ActivityEvent[] {
  return listings.map((l) => ({
    id: `evt-${hex64(`listed|${l.id}`).slice(2, 14)}`,
    kind: "listed" as const,
    actor: l.seller,
    listingId: l.id,
    title: l.title,
    amountWei: l.priceWei,
    txHash: hex64(`tx|listed|${l.id}`),
    at: l.listedAt,
  }));
}

// ---- per-address demo seed ----

export interface AccountSeed {
  datasets: Dataset[];
  /** The listing this address owns. */
  listing: Listing;
  purchases: Purchase[];
  sales: number;
  withdrawableWei: bigint;
  activity: ActivityEvent[];
}

/** Listing ids stay unique across wallets: the id carries the first eight hex characters of the owner. */
export function ownerTag(address: string): string {
  return address.toLowerCase().slice(2, 10);
}

export function seedAccount(address: Hex, groceries: Listing): AccountSeed {
  const owner = address.toLowerCase() as Hex;
  const ownListingId = `listing-medical-and-pharmacy-${ownerTag(owner)}`;
  const price = parseEther("0.03");

  const datasets: Dataset[] = [
    {
      id: "household-utilities-2026",
      name: "Household utilities 2026",
      owner,
      billCount: 1,
      status: "open",
      categories: [0],
      createdAt: SEED_BASE,
    },
    {
      id: "groceries-q3",
      name: "Groceries Q3",
      owner,
      billCount: 3,
      status: "open",
      categories: [1, 4],
      createdAt: SEED_BASE + 2 * DAY_MS,
    },
    {
      id: "medical-and-pharmacy",
      name: "Medical and pharmacy",
      owner,
      billCount: 4,
      status: "listed",
      categories: [2, 5],
      createdAt: SEED_BASE + 4 * DAY_MS,
      listingId: ownListingId,
      priceWei: price,
    },
  ];

  const listing: Listing = {
    id: ownListingId,
    datasetId: "medical-and-pharmacy",
    seller: owner,
    title: "Medical and pharmacy spend, 4 bills",
    description: "Four medical and pharmacy bills, encrypted in the seller's browser before they were listed.",
    priceWei: price,
    recordCount: 4,
    categories: [2, 5],
    listedAt: SEED_BASE + 5 * DAY_MS,
  };

  const purchases: Purchase[] = [
    {
      listingId: groceries.id,
      title: groceries.title,
      seller: groceries.seller,
      priceWei: groceries.priceWei,
      txHash: hex64(`tx|purchase|${owner}|${groceries.id}`),
      purchasedAt: SEED_BASE + 6 * DAY_MS,
      hasAccess: true,
    },
  ];

  const evt = (
    kind: ActivityEvent["kind"],
    key: string,
    actor: Hex,
    at: number,
    extra: Partial<ActivityEvent>,
  ): ActivityEvent => ({
    id: `evt-${hex64(`${key}|${owner}`).slice(2, 14)}`,
    kind,
    actor,
    txHash: hex64(`tx|${key}|${owner}`),
    at,
    ...extra,
  });

  const activity: ActivityEvent[] = [
    evt("listed", "own-listed", owner, listing.listedAt, {
      listingId: listing.id,
      title: listing.title,
      amountWei: price,
    }),
    evt("purchased", "own-purchase", owner, SEED_BASE + 6 * DAY_MS, {
      listingId: groceries.id,
      title: groceries.title,
      amountWei: groceries.priceWei,
    }),
    evt("purchased", "sale-1", DEV_SELLER_C, SEED_BASE + 7 * DAY_MS, {
      listingId: listing.id,
      title: listing.title,
      amountWei: price,
    }),
    evt("purchased", "sale-2", DEV_SELLER_B, SEED_BASE + 8 * DAY_MS, {
      listingId: listing.id,
      title: listing.title,
      amountWei: price,
    }),
    evt("withdrawn", "withdrawn", owner, SEED_BASE + 9 * DAY_MS, { amountWei: parseEther("0.04") }),
  ];

  return { datasets, listing, purchases, sales: 2, withdrawableWei: price * 2n, activity };
}
