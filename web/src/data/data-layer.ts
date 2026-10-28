import type {
  ActivityEvent,
  BillFields,
  ChainViewRow,
  Dataset,
  Listing,
  Purchase,
  SellerStats,
  TxHandle,
} from "./types";

/**
 * The seam Phases 4 and 5 swap for real contract and FHE calls. Screens reach it only through
 * data/hooks.ts. Writes resolve with a tx handle once signed; the change is visible after
 * handle.wait() resolves.
 */
export interface DataLayer {
  /** Newest first. Filtering is client-side (applyListingFilter). */
  listListings(): Promise<Listing[]>;
  getListing(id: string): Promise<Listing | null>;
  /** Mirrors the Phase 5 contract view. */
  hasAccess(listingId: string): Promise<boolean>;
  listMyDatasets(): Promise<Dataset[]>;
  /** Null when missing or not owned by the scope address. */
  getDataset(id: string): Promise<Dataset | null>;
  getSellerStats(): Promise<SellerStats>;
  /** Newest first. */
  listMyPurchases(): Promise<Purchase[]>;
  /** All marketplace events, newest first. */
  listActivity(): Promise<ActivityEvent[]>;
  /** Ciphertext handles only, never plaintext. */
  getChainView(datasetId: string): Promise<ChainViewRow[]>;

  /** The dataset exists after handle.wait(), with createdId in the receipt. */
  createDataset(input: { name: string }): Promise<TxHandle>;
  /** Takes BillFields, so the vendor cannot be passed. */
  addBill(datasetId: string, bill: BillFields): Promise<TxHandle>;
  listDataset(
    datasetId: string,
    input: { title: string; description: string; priceWei: bigint },
  ): Promise<TxHandle>;
  /** expectedPriceWei is the price the buyer saw; Phase 5 sends it as msg.value. */
  buyListing(listingId: string, expectedPriceWei: bigint): Promise<TxHandle>;
  withdraw(): Promise<TxHandle>;
}
