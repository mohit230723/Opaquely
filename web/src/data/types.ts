// Shared data types. IDs are strings (URL-safe and TanStack-key-safe); money is bigint wei or cents.

export type Hex = `0x${string}`;

export type DatasetStatus = "open" | "sealed" | "listed";

export interface Dataset {
  id: string;
  name: string;
  owner: Hex;
  billCount: number;
  status: DatasetStatus;
  categories: number[];
  createdAt: number;
  listingId?: string;
  priceWei?: bigint;
}

export interface Listing {
  id: string;
  datasetId: string;
  seller: Hex;
  title: string;
  description: string;
  priceWei: bigint;
  recordCount: number;
  categories: number[];
  listedAt: number;
}

export interface Purchase {
  listingId: string;
  /** The dataset behind the listing: the key for its analytics. */
  datasetId: string;
  title: string;
  seller: Hex;
  priceWei: bigint;
  txHash: Hex;
  purchasedAt: number;
  hasAccess: boolean;
}

/**
 * A dataset's encrypted aggregates after the connected wallet decrypted them (seller, or a buyer with access).
 * Only these totals are ever decrypted for a buyer; the per-bill ciphertexts stay sealed.
 */
export interface DatasetAnalytics {
  datasetId: string;
  /** Indexed by category id (lib/categories.ts). */
  categoryTotalsCents: bigint[];
  grandTotalCents: bigint;
  billCount: number;
  anomalyCount: number;
  /** A bill above this many cents counts as an anomaly (public contract constant). */
  anomalyThresholdCents: bigint;
  /** The Concrete ML insights, once the seller ran the models; null before that. */
  insights: MlInsights | null;
}

/** Aggregate results of the encrypted ML run, exactly what DatasetRegistry.setInsights stores. */
export interface MlInsights {
  /** Months since January 1970 of the first monthly total. */
  monthStart: number;
  /** Six monthly spend totals, oldest first. */
  monthTotalsCents: bigint[];
  /** Predicted spend for the month after the last total. */
  forecastCents: bigint;
  /** Bills the anomaly model scored at 0.5 or above. */
  mlAnomalyCount: number;
  /** Bills per anomaly-score band: 0-0.2, 0.2-0.4, 0.4-0.6, 0.6-0.8, 0.8-1. */
  scoreBuckets: number[];
}

export interface SellerStats {
  datasets: number;
  listings: number;
  sales: number;
  withdrawableWei: bigint;
}

export type ActivityKind = "listed" | "purchased" | "withdrawn";

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  actor: Hex;
  listingId?: string;
  title?: string;
  amountWei?: bigint;
  txHash: Hex;
  at: number;
}

/** Plaintext, UI only. Never reaches the DataLayer in full: see BillFields. */
export interface BillDraft {
  amountCents: bigint;
  dateDays: number;
  category: number;
  vendor: string;
}

/** What the DataLayer receives. The vendor never reaches it, so no implementation can put it on-chain. */
export type BillFields = Omit<BillDraft, "vendor">;

/** Ciphertext handles only. */
export interface ChainViewRow {
  index: number;
  amountHandle: Hex;
  categoryHandle: Hex;
  dateHandle: Hex;
}

export interface TxReceipt {
  status: "success" | "reverted";
  blockNumber: bigint;
  createdId?: string;
}

export interface TxHandle {
  hash: Hex;
  wait(): Promise<TxReceipt>;
}

export interface ListingFilter {
  categories: number[];
  minEth?: string;
  maxEth?: string;
  query?: string;
}

export interface DataScope {
  address?: Hex;
  chainId?: number;
  source: "stub" | "chain";
}
