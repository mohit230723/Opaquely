import { beforeEach, describe, expect, it } from "vitest";
import { createStubDataLayer, resetStubStore, stubControls } from "./index";
import type { Hex } from "../types";
import { ReadableTxError, WRONG_NETWORK_REASON } from "@/lib/tx-errors";

const SELLER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as Hex;
const FAST = { readMs: 0 };
const FAST_TX = { readMs: 0, signMs: 0, confirmMs: 0 };

beforeEach(() => {
  resetStubStore();
});

describe("stub data layer", () => {
  it("demo mode returns the three seeded datasets in seed order", async () => {
    const layer = createStubDataLayer({ address: SELLER, latency: FAST });
    const rows = await layer.listMyDatasets();
    expect(rows.map((d) => d.id)).toEqual(["household-utilities-2026", "groceries-q3", "medical-and-pharmacy"]);
    expect(rows.map((d) => [d.billCount, d.status])).toEqual([
      [1, "open"],
      [3, "open"],
      [4, "listed"],
    ]);
    expect(rows[2].listingId).toBeDefined();
  });

  it("mixed-case and lowercase addresses share one seed", async () => {
    const a = createStubDataLayer({ address: SELLER, latency: FAST });
    const b = createStubDataLayer({ address: SELLER.toLowerCase() as Hex, latency: FAST });
    expect(await a.listMyDatasets()).toEqual(await b.listMyDatasets());
  });

  it("empty seed mode returns no datasets", async () => {
    stubControls.setSeedMode("empty");
    const layer = createStubDataLayer({ address: SELLER, latency: FAST });
    expect(await layer.listMyDatasets()).toEqual([]);
  });

  it("returns no datasets when there is no address", async () => {
    const layer = createStubDataLayer({ latency: FAST });
    expect(await layer.listMyDatasets()).toEqual([]);
  });

  it("setSeedMode notifies subscribers and reseeds on the next read", async () => {
    const layer = createStubDataLayer({ address: SELLER, latency: FAST });
    expect(await layer.listMyDatasets()).toHaveLength(3);

    let calls = 0;
    const unsubscribe = stubControls.subscribe(() => {
      calls += 1;
    });
    stubControls.setSeedMode("empty");
    expect(calls).toBeGreaterThan(0);
    expect(stubControls.getSnapshot().seedMode).toBe("empty");
    expect(await layer.listMyDatasets()).toEqual([]);

    stubControls.setSeedMode("demo");
    expect(await layer.listMyDatasets()).toHaveLength(3);
    unsubscribe();
  });

  it("getSnapshot keeps its identity until a value changes", () => {
    const first = stubControls.getSnapshot();
    stubControls.setFailNext(false);
    expect(stubControls.getSnapshot()).toBe(first);
    stubControls.setFailNext(true);
    expect(stubControls.getSnapshot()).not.toBe(first);
  });

  it("failNextRead rejects exactly one read, then reads succeed again", async () => {
    const layer = createStubDataLayer({ address: SELLER, latency: FAST });
    stubControls.setFailNextRead(true);
    await expect(layer.listMyDatasets()).rejects.toThrow("Simulated read failure.");
    expect(stubControls.getSnapshot().failNextRead).toBe(false);
    expect(await layer.listMyDatasets()).toHaveLength(3);
  });
});

describe("stub createDataset", () => {
  it("resolves a handle, mutates only after wait(), and returns createdId in the receipt", async () => {
    const layer = createStubDataLayer({ address: SELLER, chainId: 31337, latency: FAST_TX });
    const handle = await layer.createDataset({ name: "  My new set  " });
    expect(handle.hash).toMatch(/^0x[0-9a-f]{64}$/);
    expect((await layer.listMyDatasets()).map((d) => d.name)).not.toContain("My new set");

    const receipt = await handle.wait();
    expect(receipt.status).toBe("success");
    expect(receipt.createdId).toBeTruthy();

    const rows = await layer.listMyDatasets();
    const created = rows.find((d) => d.id === receipt.createdId);
    expect(created).toMatchObject({ name: "My new set", billCount: 0, status: "open", categories: [] });
    expect(created?.owner).toBe(SELLER.toLowerCase());
  });

  it("gives two datasets with the same name different ids and different hashes", async () => {
    const layer = createStubDataLayer({ address: SELLER, latency: FAST_TX });
    const a = await layer.createDataset({ name: "Same" });
    const b = await layer.createDataset({ name: "Same" });
    expect(a.hash).not.toBe(b.hash);
    const [ra, rb] = [await a.wait(), await b.wait()];
    expect(ra.createdId).not.toBe(rb.createdId);
  });

  it("failNext rejects once with the simulated reason and clears the flag", async () => {
    const layer = createStubDataLayer({ address: SELLER, latency: FAST_TX });
    stubControls.setFailNext(true);
    const err = await layer.createDataset({ name: "Nope" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ReadableTxError);
    expect((err as ReadableTxError).reason).toBe("Simulated failure: execution reverted.");
    expect(stubControls.getSnapshot().failNext).toBe(false);
    expect((await layer.listMyDatasets()).map((d) => d.name)).not.toContain("Nope");
    await expect(layer.createDataset({ name: "Fine" })).resolves.toBeDefined();
  });

  it("rejects a blank or over-60-character name before signing, without consuming failNext", async () => {
    const layer = createStubDataLayer({ address: SELLER, latency: FAST_TX });
    stubControls.setFailNext(true);
    for (const name of ["", "   ", "x".repeat(61)]) {
      await expect(layer.createDataset({ name })).rejects.toThrow("Give your dataset a name (1 to 60 characters).");
    }
    expect(stubControls.getSnapshot().failNext).toBe(true);
    await expect(layer.createDataset({ name: "x".repeat(60) })).rejects.toThrow("Simulated failure");
  });

  it("refuses a write on a chain other than 31337 with the wrong-network reason", async () => {
    const layer = createStubDataLayer({ address: SELLER, chainId: 1, latency: FAST_TX });
    const err = await layer.createDataset({ name: "Wrong chain" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ReadableTxError);
    expect((err as ReadableTxError).reason).toBe(WRONG_NETWORK_REASON);
    expect((err as ReadableTxError).code).toBe("wrong_network");
  });

  it("allows writes on chain 31337 and with an undefined chain", async () => {
    for (const chainId of [31337, undefined]) {
      const layer = createStubDataLayer({ address: SELLER, chainId, latency: FAST_TX });
      const handle = await layer.createDataset({ name: "Ok " + String(chainId) });
      expect((await handle.wait()).status).toBe("success");
    }
  });

  it("refuses a write when no wallet is connected", async () => {
    const layer = createStubDataLayer({ latency: FAST_TX });
    await expect(layer.createDataset({ name: "No wallet" })).rejects.toThrow("Connect your wallet to continue.");
  });
});

// ---- plan 01-07: the complete marketplace ----

const BUYER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as Hex;
const HASH = /^0x[0-9a-f]{64}$/;
const ETH = 10n ** 18n;

function seller() {
  return createStubDataLayer({ address: SELLER, latency: FAST_TX });
}

async function confirm(handle: { wait(): Promise<unknown> }) {
  return (await handle.wait()) as { status: string; createdId?: string };
}

describe("stub demo seed", () => {
  it("lists 6 listings covering all 6 categories, priced 0.01 to 0.25 ETH", async () => {
    const rows = await seller().listListings();
    expect(rows).toHaveLength(6);
    const cats = new Set(rows.flatMap((l) => l.categories));
    expect([...cats].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    for (const l of rows) {
      expect(l.priceWei).toBeGreaterThanOrEqual(ETH / 100n);
      expect(l.priceWei).toBeLessThanOrEqual((ETH * 25n) / 100n);
    }
  });

  it("never stamps seeded or newly created events in the future", async () => {
    const layer = createStubDataLayer({ address: SELLER, latency: FAST_TX });
    const before = Date.now();
    const seededAts = [
      ...(await layer.listActivity()).map((e) => e.at),
      ...(await layer.listListings()).map((l) => l.listedAt),
      ...(await layer.listMyDatasets()).map((d) => d.createdAt),
      ...(await layer.listMyPurchases()).map((p) => p.purchasedAt),
    ];
    for (const at of seededAts) expect(at).toBeLessThan(before);

    const handle = await layer.createDataset({ name: "Fresh dataset" });
    const receipt = await handle.wait();
    const created = (await layer.listMyDatasets()).find((d) => d.id === receipt.createdId);
    expect(created).toBeDefined();
    const createdAt = created?.createdAt ?? 0;
    expect(createdAt).toBeGreaterThanOrEqual(before);
    expect(createdAt).toBeLessThanOrEqual(Date.now() + 1000);
    for (const at of seededAts) expect(createdAt).toBeGreaterThan(at);
  });

  it("has exactly one own listing and one already-bought listing", async () => {
    const layer = seller();
    const rows = await layer.listListings();
    const own = rows.filter((l) => l.seller.toLowerCase() === SELLER.toLowerCase());
    expect(own).toHaveLength(1);
    const bought: string[] = [];
    for (const l of rows) if (await layer.hasAccess(l.id)) bought.push(l.id);
    expect(bought).toHaveLength(1);
    const purchases = await layer.listMyPurchases();
    expect(purchases).toHaveLength(1);
    expect(purchases[0].listingId).toBe(bought[0]);
    expect(purchases[0].txHash).toMatch(HASH);
  });

  it("pins the five global listings to known prices and categories, plus the own listing", async () => {
    const rows = await seller().listListings();
    const pairs = rows.map((l) => [l.priceWei, l.categories] as const);
    const find = (price: bigint) => pairs.find(([p]) => p === price)?.[1];
    expect(find(20_000_000_000_000_000n)).toEqual([0]);
    expect(find(50_000_000_000_000_000n)).toEqual([1]);
    expect(find(80_000_000_000_000_000n)).toEqual([2]);
    expect(find(10_000_000_000_000_000n)).toEqual([3]);
    expect(find(250_000_000_000_000_000n)).toEqual([4, 5]);
    expect(find(30_000_000_000_000_000n)).toEqual([2, 5]);
    expect(rows.filter((l) => l.priceWei >= 200_000_000_000_000_000n)).toHaveLength(1);
    expect(rows.filter((l) => l.categories.includes(2))).toHaveLength(2);
  });

  it("has one 70-character title with a 280-character description", async () => {
    const rows = await seller().listListings();
    const long = rows.filter((l) => l.title.length === 70);
    expect(long).toHaveLength(1);
    expect(long[0].description).toHaveLength(280);
  });

  it("lists newest first and finds a listing by id", async () => {
    const layer = seller();
    const rows = await layer.listListings();
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].listedAt).toBeGreaterThanOrEqual(rows[i].listedAt);
    expect((await layer.getListing(rows[2].id))?.id).toBe(rows[2].id);
    expect(await layer.getListing("nope")).toBeNull();
  });

  it("gives the seller 3 datasets, 1 listing, sales and a withdrawable balance", async () => {
    const stats = await seller().getSellerStats();
    expect(stats.datasets).toBe(3);
    expect(stats.listings).toBe(1);
    expect(stats.sales).toBeGreaterThanOrEqual(1);
    expect(stats.withdrawableWei).toBeGreaterThan(0n);
  });

  it("has listed, purchased and withdrawn events, newest first, with the fields the timeline needs", async () => {
    const events = await seller().listActivity();
    const kinds = new Set(events.map((e) => e.kind));
    expect(kinds).toEqual(new Set(["listed", "purchased", "withdrawn"]));
    for (let i = 1; i < events.length; i++) expect(events[i - 1].at).toBeGreaterThanOrEqual(events[i].at);
    for (const e of events) {
      expect(e.txHash).toMatch(HASH);
      expect(e.actor).toMatch(/^0x/);
      if (e.kind !== "withdrawn") expect(e.title && e.listingId && e.amountWei).toBeTruthy();
      else expect(e.amountWei).toBeGreaterThan(0n);
    }
  });

  it("getDataset returns an owned dataset and null otherwise", async () => {
    const layer = seller();
    expect((await layer.getDataset("groceries-q3"))?.billCount).toBe(3);
    expect(await layer.getDataset("missing")).toBeNull();
  });
});

describe("stub empty mode", () => {
  it("returns nothing from every read and zero stats", async () => {
    stubControls.setSeedMode("empty");
    const layer = seller();
    expect(await layer.listListings()).toEqual([]);
    expect(await layer.listMyDatasets()).toEqual([]);
    expect(await layer.listMyPurchases()).toEqual([]);
    expect(await layer.listActivity()).toEqual([]);
    expect(await layer.getListing("listing-fuel-rides")).toBeNull();
    expect(await layer.getDataset("groceries-q3")).toBeNull();
    expect(await layer.getChainView("groceries-q3")).toEqual([]);
    expect(await layer.hasAccess("listing-fuel-rides")).toBe(false);
    expect(await layer.getSellerStats()).toEqual({ datasets: 0, listings: 0, sales: 0, withdrawableWei: 0n });
  });
});

describe("stub chain view", () => {
  it("has one row per seeded bill with distinct, deterministic 66-character handles", async () => {
    const layer = seller();
    const [one, three, four] = await Promise.all([
      layer.getChainView("household-utilities-2026"),
      layer.getChainView("groceries-q3"),
      layer.getChainView("medical-and-pharmacy"),
    ]);
    expect([one.length, three.length, four.length]).toEqual([1, 3, 4]);
    expect(three.map((r) => r.index)).toEqual([0, 1, 2]);
    const handles = three.flatMap((r) => [r.amountHandle, r.categoryHandle, r.dateHandle]);
    expect(new Set(handles).size).toBe(9);
    for (const h of handles) expect(h).toMatch(HASH);

    expect(await layer.getChainView("groceries-q3")).toEqual(three);
    resetStubStore();
    expect(await seller().getChainView("groceries-q3")).toEqual(three);
  });

  it("returns no rows for an unknown dataset", async () => {
    expect(await seller().getChainView("missing")).toEqual([]);
  });
});

describe("stub addBill", () => {
  it("changes nothing until wait(), then adds a bill, a category and a chain row", async () => {
    const layer = seller();
    const handle = await layer.addBill("household-utilities-2026", { amountCents: 12345n, dateDays: 20000, category: 3 });
    expect((await layer.getDataset("household-utilities-2026"))?.billCount).toBe(1);
    expect((await confirm(handle)).status).toBe("success");

    const dataset = await layer.getDataset("household-utilities-2026");
    expect(dataset?.billCount).toBe(2);
    expect(dataset?.categories).toEqual([0, 3]);
    const rows = await layer.getChainView("household-utilities-2026");
    expect(rows).toHaveLength(2);
    expect(rows[0].amountHandle).not.toBe(rows[1].amountHandle);
    for (const r of rows) expect(r.amountHandle).toMatch(HASH);
  });

  it("rejects a listed dataset and an unknown dataset with readable reasons", async () => {
    const layer = seller();
    const bill = { amountCents: 100n, dateDays: 20000, category: 0 };
    const sealed = await layer.addBill("medical-and-pharmacy", bill).catch((e: unknown) => e);
    expect(sealed).toBeInstanceOf(ReadableTxError);
    expect((sealed as ReadableTxError).reason).toBe("This dataset is sealed. Create a new dataset to add more bills.");
    expect((sealed as ReadableTxError).code).toBe("reverted");
    await expect(layer.addBill("missing", bill)).rejects.toThrow("Dataset not found.");
  });

  it("validates amount, category and date", async () => {
    const layer = seller();
    const ok = { amountCents: 100n, dateDays: 20000, category: 0 };
    await expect(layer.addBill("groceries-q3", { ...ok, amountCents: 0n })).rejects.toThrow("greater than 0");
    await expect(layer.addBill("groceries-q3", { ...ok, category: 6 })).rejects.toThrow("six categories");
    await expect(layer.addBill("groceries-q3", { ...ok, dateDays: -1 })).rejects.toThrow("valid bill date");
    await expect(layer.addBill("groceries-q3", { ...ok, dateDays: 1.5 })).rejects.toThrow("valid bill date");
  });
});

describe("stub listDataset", () => {
  const terms = { title: "My groceries", description: "Three bills", priceWei: 30_000_000_000_000_000n };

  it("rejects an under-filled dataset and a zero price", async () => {
    const layer = seller();
    const few = await layer.listDataset("household-utilities-2026", terms).catch((e: unknown) => e);
    expect((few as ReadableTxError).reason).toBe("Add at least 3 bills before listing. This dataset has 1.");
    expect((few as ReadableTxError).code).toBe("reverted");
    await expect(layer.listDataset("groceries-q3", { ...terms, priceWei: 0n })).rejects.toThrow(
      "Enter a price greater than 0 ETH.",
    );
  });

  it("lists the 3-bill dataset: seals it, creates the listing and a listed event first", async () => {
    const layer = seller();
    const handle = await layer.listDataset("groceries-q3", terms);
    expect((await layer.getDataset("groceries-q3"))?.status).toBe("open");
    const receipt = await confirm(handle);
    expect(receipt.createdId).toBeTruthy();

    const dataset = await layer.getDataset("groceries-q3");
    expect(dataset?.status).toBe("listed");
    expect(dataset?.priceWei).toBe(terms.priceWei);
    const listing = await layer.getListing(receipt.createdId as string);
    expect(listing).toMatchObject({ recordCount: 3, categories: [1, 4], title: "My groceries" });
    expect(listing?.seller).toBe(SELLER.toLowerCase());
    const events = await layer.listActivity();
    expect(events[0]).toMatchObject({ kind: "listed", listingId: receipt.createdId, amountWei: terms.priceWei });
    expect((await layer.getSellerStats()).listings).toBe(2);
  });

  it("then refuses new bills and a second listing", async () => {
    const layer = seller();
    await confirm(await layer.listDataset("groceries-q3", terms));
    await expect(layer.addBill("groceries-q3", { amountCents: 100n, dateDays: 1, category: 0 })).rejects.toThrow("sealed");
    await expect(layer.listDataset("groceries-q3", terms)).rejects.toThrow("already listed");
  });
});

describe("stub buyListing", () => {
  it("rejects buying your own listing and buying twice", async () => {
    const layer = seller();
    const rows = await layer.listListings();
    const own = rows.find((l) => l.seller.toLowerCase() === SELLER.toLowerCase())!;
    const owned = (await layer.listMyPurchases())[0];
    const err = await layer.buyListing(own.id, own.priceWei).catch((e: unknown) => e);
    expect((err as ReadableTxError).reason).toBe("You cannot buy your own listing.");
    expect((err as ReadableTxError).code).toBe("reverted");
    const twice = await layer.buyListing(owned.listingId, owned.priceWei).catch((e: unknown) => e);
    expect((twice as ReadableTxError).reason).toBe("You already own this dataset.");
  });

  it("rejects a stale price and an unknown listing", async () => {
    const buyer = createStubDataLayer({ address: BUYER, latency: FAST_TX });
    const target = (await buyer.listListings()).find((l) => l.priceWei === 20_000_000_000_000_000n)!;
    const err = await buyer.buyListing(target.id, target.priceWei + 1n).catch((e: unknown) => e);
    expect((err as ReadableTxError).reason).toBe("The price changed. Reload the listing and try again.");
    await expect(buyer.buyListing("nope", 1n)).rejects.toThrow("Listing not found.");
  });

  it("lets another wallet buy: it gains access, the seller earns the price", async () => {
    const layer = seller();
    const own = (await layer.listListings()).find((l) => l.seller.toLowerCase() === SELLER.toLowerCase())!;
    const before = await layer.getSellerStats();

    const buyer = createStubDataLayer({ address: BUYER, latency: FAST_TX });
    const handle = await buyer.buyListing(own.id, own.priceWei);
    expect(await buyer.hasAccess(own.id)).toBe(false);
    await confirm(handle);

    expect(await buyer.hasAccess(own.id)).toBe(true);
    expect((await buyer.listMyPurchases())[0]).toMatchObject({ listingId: own.id, priceWei: own.priceWei });
    const after = await layer.getSellerStats();
    expect(after.sales).toBe(before.sales + 1);
    expect(after.withdrawableWei).toBe(before.withdrawableWei + own.priceWei);
    expect((await layer.listActivity())[0]).toMatchObject({ kind: "purchased", actor: BUYER, listingId: own.id });
  });
});

describe("stub withdraw", () => {
  it("pays out the whole balance once, then reports nothing to withdraw", async () => {
    const layer = seller();
    const before = await layer.getSellerStats();
    expect(before.withdrawableWei).toBeGreaterThan(0n);
    await confirm(await layer.withdraw());
    expect((await layer.getSellerStats()).withdrawableWei).toBe(0n);
    expect((await layer.listActivity())[0]).toMatchObject({ kind: "withdrawn", amountWei: before.withdrawableWei });
    const err = await layer.withdraw().catch((e: unknown) => e);
    expect((err as ReadableTxError).reason).toBe("Nothing to withdraw yet.");
    expect((err as ReadableTxError).code).toBe("reverted");
  });

  it("rejects a withdraw in empty mode", async () => {
    stubControls.setSeedMode("empty");
    await expect(seller().withdraw()).rejects.toThrow("Nothing to withdraw yet.");
  });
});

describe("stub failure switches", () => {
  it("failNext rejects the next write of any kind once", async () => {
    const layer = seller();
    for (const send of [
      () => layer.addBill("groceries-q3", { amountCents: 100n, dateDays: 1, category: 0 }),
      () => layer.listDataset("groceries-q3", { title: "T", description: "", priceWei: 1n }),
      () => layer.withdraw(),
    ]) {
      stubControls.setFailNext(true);
      await expect(send()).rejects.toThrow("Simulated failure: execution reverted.");
    }
    expect(stubControls.getSnapshot().failNext).toBe(false);
  });

  it("failNextRead rejects the next read of any method once", async () => {
    const layer = seller();
    const reads = [
      () => layer.listListings(),
      () => layer.getListing("listing-fuel-rides"),
      () => layer.hasAccess("x"),
      () => layer.getDataset("groceries-q3"),
      () => layer.getSellerStats(),
      () => layer.listMyPurchases(),
      () => layer.listActivity(),
      () => layer.getChainView("groceries-q3"),
    ];
    for (const read of reads) {
      stubControls.setFailNextRead(true);
      await expect(read()).rejects.toThrow("Simulated read failure.");
      await expect(read()).resolves.toBeDefined();
    }
  });
});
