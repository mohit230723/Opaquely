import type { ActivityEvent, BillFields, ChainViewRow, Dataset, Hex, Listing, Purchase } from "../types";
import type { DataLayer } from "../data-layer";
import { MIN_BILLS_TO_LIST } from "@/lib/constants";
import { isCategoryId } from "@/lib/categories";
import { ReadableTxError, REVERT_REASONS } from "@/lib/tx-errors";
import {
  accountFor,
  allActivity,
  allListings,
  beforeRead,
  nextId,
  nextTxHash,
  pushActivity,
  seededAccount,
  stubNow,
  stubTx,
  type Account,
  type StubOptions,
} from "./store";
import { handleFor, ownerTag } from "./seed";

export { stubControls, resetStubStore, type SeedMode, type StubOptions } from "./store";

const NAME_ERROR = "Give your dataset a name (1 to 60 characters).";
const TITLE_ERROR = "Give your listing a title (1 to 80 characters).";
const DESCRIPTION_ERROR = "Keep the description to 300 characters or fewer.";
const NOT_CONNECTED = "Connect your wallet to continue.";

/** A rule the stub enforces the way the contract will: readable reason, code "reverted". */
function revert(reason: string): ReadableTxError {
  return new ReadableTxError(reason, "reverted");
}

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // "new" is the create-form route segment, so a dataset with that id would be unreachable.
  if (slug === "new") return "new-dataset";
  return slug || "dataset";
}

function copyDataset(d: Dataset): Dataset {
  return { ...d, categories: [...d.categories] };
}

function copyListing(l: Listing): Listing {
  return { ...l, categories: [...l.categories] };
}

function newestFirst<T>(rows: T[], at: (row: T) => number): T[] {
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => at(b.row) - at(a.row) || a.i - b.i)
    .map((x) => x.row);
}

function findOwned(acct: Account, datasetId: string): Dataset {
  const dataset = acct.datasets.find((d) => d.id === datasetId);
  if (!dataset) throw revert("Dataset not found.");
  return dataset;
}

export function createStubDataLayer(opts: StubOptions): DataLayer {
  const { address, latency } = opts;

  function requireAddress(): Hex {
    if (!address) throw new ReadableTxError(NOT_CONNECTED);
    return address;
  }

  function event(kind: ActivityEvent["kind"], actor: Hex, extra: Partial<ActivityEvent>): ActivityEvent {
    return { id: `evt-${nextId()}`, kind, actor, txHash: nextTxHash(), at: stubNow(), ...extra };
  }

  /** The buy rules, checked before signing and again when the receipt lands. */
  function checkBuy(buyer: Hex, listingId: string, expectedPriceWei: bigint): Listing {
    const listing = allListings().get(listingId);
    if (!listing) throw revert("Listing not found.");
    if (listing.seller.toLowerCase() === buyer.toLowerCase()) throw revert(REVERT_REASONS.OwnListing);
    if (seededAccount(buyer).purchases.some((p) => p.listingId === listingId)) {
      throw revert(REVERT_REASONS.AlreadyPurchased);
    }
    if (expectedPriceWei !== listing.priceWei) throw revert(REVERT_REASONS.PriceChanged);
    return listing;
  }

  return {
    // ---- reads ----

    async listListings() {
      await beforeRead(address, latency?.readMs);
      if (address) seededAccount(address);
      return newestFirst([...allListings().values()], (l) => l.listedAt).map(copyListing);
    },

    async getListing(id) {
      await beforeRead(address, latency?.readMs);
      if (address) seededAccount(address);
      const listing = allListings().get(id);
      return listing ? copyListing(listing) : null;
    },

    async hasAccess(listingId) {
      await beforeRead(address, latency?.readMs);
      if (!address) return false;
      return seededAccount(address).purchases.some((p) => p.listingId === listingId && p.hasAccess);
    },

    async listMyDatasets() {
      await beforeRead(address, latency?.readMs);
      if (!address) return [];
      return seededAccount(address).datasets.map(copyDataset);
    },

    async getDataset(id) {
      await beforeRead(address, latency?.readMs);
      if (!address) return null;
      const dataset = seededAccount(address).datasets.find((d) => d.id === id);
      return dataset ? copyDataset(dataset) : null;
    },

    async getSellerStats() {
      await beforeRead(address, latency?.readMs);
      if (!address) return { datasets: 0, listings: 0, sales: 0, withdrawableWei: 0n };
      const acct = seededAccount(address);
      return {
        datasets: acct.datasets.length,
        listings: acct.datasets.filter((d) => d.status === "listed").length,
        sales: acct.sales,
        withdrawableWei: acct.withdrawableWei,
      };
    },

    async listMyPurchases() {
      await beforeRead(address, latency?.readMs);
      if (!address) return [];
      const rows: Purchase[] = seededAccount(address).purchases.map((p) => ({ ...p }));
      return newestFirst(rows, (p) => p.purchasedAt);
    },

    async listActivity() {
      await beforeRead(address, latency?.readMs);
      if (address) seededAccount(address);
      return newestFirst(allActivity(), (e) => e.at).map((e) => ({ ...e }));
    },

    async getChainView(datasetId) {
      await beforeRead(address, latency?.readMs);
      if (!address) return [];
      const dataset = seededAccount(address).datasets.find((d) => d.id === datasetId);
      if (!dataset) return [];
      const owner = address.toLowerCase();
      const rows: ChainViewRow[] = [];
      for (let index = 0; index < dataset.billCount; index++) {
        rows.push({
          index,
          amountHandle: handleFor(owner, datasetId, index, "amount"),
          categoryHandle: handleFor(owner, datasetId, index, "category"),
          dateHandle: handleFor(owner, datasetId, index, "date"),
        });
      }
      return rows;
    },

    // ---- writes: validate first, then sign, then change the store only when the receipt lands ----

    async createDataset({ name }) {
      const trimmed = name.trim();
      if (trimmed.length < 1 || trimmed.length > 60) throw new ReadableTxError(NAME_ERROR);
      const me = requireAddress();
      return stubTx({
        chainId: opts.chainId,
        latency,
        apply: () => {
          const rows = seededAccount(me).datasets;
          const base = slugify(trimmed);
          let id = base;
          for (let n = 2; rows.some((d) => d.id === id); n++) id = `${base}-${n}`;
          rows.push({
            id,
            name: trimmed,
            owner: me.toLowerCase() as Hex,
            billCount: 0,
            status: "open",
            categories: [],
            createdAt: stubNow(),
          });
          return id;
        },
      });
    },

    async addBill(datasetId: string, bill: BillFields) {
      const me = requireAddress();
      const check = () => {
        const dataset = findOwned(seededAccount(me), datasetId);
        if (dataset.status !== "open") {
          throw revert("This dataset is sealed. Create a new dataset to add more bills.");
        }
        return dataset;
      };
      check();
      if (bill.amountCents <= 0n) throw revert("Enter an amount greater than 0.");
      if (!isCategoryId(bill.category)) throw revert("Choose one of the six categories.");
      if (!Number.isInteger(bill.dateDays) || bill.dateDays < 0) throw revert("Enter a valid bill date.");
      return stubTx({
        chainId: opts.chainId,
        latency,
        apply: () => {
          const dataset = check();
          dataset.billCount += 1;
          if (!dataset.categories.includes(bill.category)) {
            dataset.categories = [...dataset.categories, bill.category].sort((a, b) => a - b);
          }
          return undefined;
        },
      });
    },

    async listDataset(datasetId, input) {
      const me = requireAddress();
      const title = input.title.trim();
      const description = input.description.trim();
      const check = () => {
        const dataset = findOwned(seededAccount(me), datasetId);
        if (dataset.status === "listed") throw revert("This dataset is already listed.");
        if (dataset.status === "sealed") throw revert("This dataset is sealed. Create a new dataset to add more bills.");
        if (dataset.billCount < MIN_BILLS_TO_LIST) {
          throw revert(`Add at least ${MIN_BILLS_TO_LIST} bills before listing. This dataset has ${dataset.billCount}.`);
        }
        return dataset;
      };
      check();
      if (input.priceWei <= 0n) throw revert("Enter a price greater than 0 ETH.");
      if (title.length < 1 || title.length > 80) throw revert(TITLE_ERROR);
      if (description.length > 300) throw revert(DESCRIPTION_ERROR);
      return stubTx({
        chainId: opts.chainId,
        latency,
        apply: () => {
          const dataset = check();
          const listingId = `listing-${dataset.id}-${ownerTag(me)}`;
          const listing: Listing = {
            id: listingId,
            datasetId: dataset.id,
            seller: me.toLowerCase() as Hex,
            title,
            description,
            priceWei: input.priceWei,
            recordCount: dataset.billCount,
            categories: [...dataset.categories],
            listedAt: stubNow(),
          };
          allListings().set(listingId, listing);
          dataset.status = "listed";
          dataset.listingId = listingId;
          dataset.priceWei = input.priceWei;
          pushActivity(event("listed", me, { listingId, title, amountWei: input.priceWei }));
          return listingId;
        },
      });
    },

    async buyListing(listingId, expectedPriceWei) {
      const me = requireAddress();
      checkBuy(me, listingId, expectedPriceWei);
      return stubTx({
        chainId: opts.chainId,
        latency,
        apply: () => {
          const listing = checkBuy(me, listingId, expectedPriceWei);
          const purchase: Purchase = {
            listingId,
            title: listing.title,
            seller: listing.seller,
            priceWei: listing.priceWei,
            txHash: nextTxHash(),
            purchasedAt: stubNow(),
            hasAccess: true,
          };
          seededAccount(me).purchases.unshift(purchase);
          const seller = accountFor(listing.seller);
          seller.sales += 1;
          seller.withdrawableWei += listing.priceWei;
          pushActivity({
            id: `evt-${nextId()}`,
            kind: "purchased",
            actor: me,
            listingId,
            title: listing.title,
            amountWei: listing.priceWei,
            txHash: purchase.txHash,
            at: purchase.purchasedAt,
          });
          return undefined;
        },
      });
    },

    async withdraw() {
      const me = requireAddress();
      const check = () => {
        const acct = seededAccount(me);
        if (acct.withdrawableWei <= 0n) throw revert("Nothing to withdraw yet.");
        return acct;
      };
      check();
      return stubTx({
        chainId: opts.chainId,
        latency,
        apply: () => {
          const acct = check();
          const amount = acct.withdrawableWei;
          acct.withdrawableWei = 0n;
          pushActivity(event("withdrawn", me, { amountWei: amount }));
          return undefined;
        },
      });
    },
  };
}
