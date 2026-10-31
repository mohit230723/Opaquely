import { parseEther } from "viem";
import { describe, expect, it } from "vitest";
import type { ActivityEvent, Dataset, Hex, Purchase } from "@/data/types";
import { deriveSales, myListingIdsOf } from "./my-sales";

const ME = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as Hex;
const BUYER_A = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as Hex;
const BUYER_B = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as Hex;
const OTHER_SELLER = "0x90F79bf6EB2c4f870365E785982E1f101E93b906" as Hex;
const TX = ("0x" + "ab".repeat(32)) as Hex;

let seq = 0;
function event(partial: Partial<ActivityEvent>): ActivityEvent {
  seq += 1;
  return { id: `e${seq}`, kind: "listed", actor: ME, txHash: TX, at: 0, ...partial };
}

function purchase(priceEth: string, listingId = "X"): Purchase {
  return {
    listingId,
    datasetId: listingId,
    title: "T",
    seller: OTHER_SELLER,
    priceWei: parseEther(priceEth),
    txHash: TX,
    purchasedAt: 0,
    hasAccess: true,
  };
}

function dataset(partial: Partial<Dataset>): Dataset {
  return { id: "d", name: "D", owner: ME, billCount: 3, status: "open", categories: [], createdAt: 0, ...partial };
}

const MINE = new Set(["L1"]);

describe("deriveSales", () => {
  it("groups two purchases of my listing into one entry and sums them into total earned", () => {
    const events = [
      event({ kind: "purchased", actor: BUYER_A, listingId: "L1", amountWei: parseEther("0.03") }),
      event({ kind: "purchased", actor: BUYER_B, listingId: "L1", amountWei: parseEther("0.03") }),
    ];
    const s = deriveSales({ me: ME, myListingIds: MINE, events, purchases: [] });
    expect(s.perListing.get("L1")).toEqual({ count: 2, totalWei: parseEther("0.06") });
    expect(s.totalEarnedWei).toBe(parseEther("0.06"));
  });

  it("ignores a purchase of another seller's listing unless I am the buyer", () => {
    const theirs = event({ kind: "purchased", actor: BUYER_A, listingId: "L9", amountWei: parseEther("0.05") });
    const s = deriveSales({ me: ME, myListingIds: MINE, events: [theirs], purchases: [] });
    expect(s.perListing.has("L9")).toBe(false);
    expect(s.perListing.size).toBe(0);
    expect(s.totalEarnedWei).toBe(0n);
    expect(s.myHistory).toEqual([]);

    const mine = event({ kind: "purchased", actor: ME, listingId: "L9", amountWei: parseEther("0.05") });
    const s2 = deriveSales({ me: ME, myListingIds: MINE, events: [theirs, mine], purchases: [] });
    expect(s2.perListing.has("L9")).toBe(false);
    expect(s2.totalEarnedWei).toBe(0n);
    expect(s2.myHistory).toEqual([mine]);
  });

  it("sums only my withdrawals, comparing addresses case-insensitively", () => {
    const events = [
      event({ kind: "withdrawn", actor: ME.toLowerCase() as Hex, amountWei: parseEther("0.04") }),
      event({ kind: "withdrawn", actor: ME, amountWei: parseEther("0.01") }),
      event({ kind: "withdrawn", actor: OTHER_SELLER, amountWei: parseEther("1") }),
    ];
    const s = deriveSales({ me: ME.toUpperCase().replace("0X", "0x"), myListingIds: MINE, events, purchases: [] });
    expect(s.totalWithdrawnWei).toBe(parseEther("0.05"));
  });

  it("totals what I spent from my purchases", () => {
    const s = deriveSales({
      me: ME,
      myListingIds: MINE,
      events: [],
      purchases: [purchase("0.05"), purchase("0.02", "Y")],
    });
    expect(s.totalSpentWei).toBe(parseEther("0.07"));
  });

  it("keeps my listings, my buys, sales of my listings and my withdrawals in input order", () => {
    const listed = event({ kind: "listed", actor: ME, listingId: "L1", amountWei: parseEther("0.03") });
    const otherListed = event({ kind: "listed", actor: OTHER_SELLER, listingId: "L9" });
    const sale = event({ kind: "purchased", actor: BUYER_A, listingId: "L1", amountWei: parseEther("0.03") });
    const otherSale = event({ kind: "purchased", actor: BUYER_B, listingId: "L9", amountWei: parseEther("0.05") });
    const myBuy = event({ kind: "purchased", actor: ME, listingId: "L9", amountWei: parseEther("0.05") });
    const withdrawn = event({ kind: "withdrawn", actor: ME, amountWei: parseEther("0.03") });
    const otherWithdrawn = event({ kind: "withdrawn", actor: OTHER_SELLER, amountWei: parseEther("0.05") });
    // Newest first, as useActivity returns them.
    const events = [withdrawn, otherWithdrawn, myBuy, otherSale, sale, otherListed, listed];
    const s = deriveSales({ me: ME, myListingIds: MINE, events, purchases: [] });
    expect(s.myHistory).toEqual([withdrawn, myBuy, sale, listed]);
  });

  it("counts a purchase without an amount as one sale worth 0", () => {
    const events = [
      event({ kind: "purchased", actor: BUYER_A, listingId: "L1" }),
      event({ kind: "purchased", actor: BUYER_B, listingId: "L1", amountWei: parseEther("0.03") }),
    ];
    const s = deriveSales({ me: ME, myListingIds: MINE, events, purchases: [] });
    expect(s.perListing.get("L1")).toEqual({ count: 2, totalWei: parseEther("0.03") });
    expect(s.totalEarnedWei).toBe(parseEther("0.03"));
  });

  it("returns zero totals and an empty history when no wallet is connected", () => {
    const events = [
      event({ kind: "purchased", actor: BUYER_A, listingId: "L1", amountWei: parseEther("0.03") }),
      event({ kind: "withdrawn", actor: ME, amountWei: parseEther("0.04") }),
    ];
    const s = deriveSales({ me: undefined, myListingIds: MINE, events, purchases: [purchase("0.05")] });
    expect(s.perListing.size).toBe(0);
    expect(s.totalEarnedWei).toBe(0n);
    expect(s.totalWithdrawnWei).toBe(0n);
    expect(s.totalSpentWei).toBe(0n);
    expect(s.myHistory).toEqual([]);
  });
});

describe("myListingIdsOf", () => {
  it("returns the listing id of every dataset that has one", () => {
    const ids = myListingIdsOf([
      dataset({ id: "a" }),
      dataset({ id: "b", status: "listed", listingId: "L1" }),
      dataset({ id: "c", status: "listed", listingId: "L2" }),
    ]);
    expect([...ids].sort()).toEqual(["L1", "L2"]);
  });

  it("is empty for no datasets", () => {
    expect(myListingIdsOf([]).size).toBe(0);
  });
});
