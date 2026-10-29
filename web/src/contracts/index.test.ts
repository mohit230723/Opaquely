import { describe, expect, it } from "vitest";
import type { AbiFunction, AbiParameter } from "viem";
import { getDeployment } from "./index";
import { deployments } from "./deployments";
import { REVERT_REASONS } from "@/lib/tx-errors";

// The live DataLayer reads these names. If a contract rename or a re-generated ABI drops one, this
// fails before a browser does.
const d = getDeployment(31337)!;

function fn(abi: readonly { type: string; name?: string }[], name: string): AbiFunction {
  const f = abi.find((x) => x.type === "function" && x.name === name);
  expect(f, `function ${name}`).toBeDefined();
  return f as AbiFunction;
}
function ev(abi: readonly { type: string; name?: string }[], name: string): { inputs: AbiParameter[] } {
  const e = abi.find((x) => x.type === "event" && x.name === name);
  expect(e, `event ${name}`).toBeDefined();
  return e as unknown as { inputs: AbiParameter[] };
}
function tupleNames(f: AbiFunction): string[] {
  const out = f.outputs[0] as AbiParameter & { components?: AbiParameter[] };
  return (out.components ?? []).map((c) => c.name ?? "");
}
const names = (ps: readonly AbiParameter[]) => ps.map((p) => p.name);

describe("getDeployment", () => {
  it("returns checksummed addresses and a bigint deploy block for 31337", () => {
    expect(d.registry.address).toBe("0x5FbDB2315678afecb367f032d93F642f64180aa3");
    expect(d.market.address).toBe("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");
    expect(typeof d.deployBlock).toBe("bigint");
  });
  it("returns null for chains with no deployment", () => {
    expect(getDeployment(11155111) === null).toBe(!("11155111" in deployments));
    expect(getDeployment(1)).toBeNull();
  });
});

describe("registry ABI", () => {
  it("has every function and event the live layer calls", () => {
    for (const n of ["createDataset", "datasetsByOwner", "getDataset", "getBillHandles", "getAggregates", "MAX_BILLS_PER_DATASET", "MIN_BILLS_TO_LIST"]) {
      fn(d.registry.abi, n);
    }
    expect(fn(d.registry.abi, "addRecord").inputs).toHaveLength(5);
    expect(names(ev(d.registry.abi, "DatasetCreated").inputs)).toContain("datasetId");
  });
  it("keeps the tuple shapes the layer reads", () => {
    expect(tupleNames(fn(d.registry.abi, "getDataset"))).toEqual(["id", "owner", "name", "recordCount", "isSealed", "createdAt"]);
    expect(tupleNames(fn(d.registry.abi, "getBillHandles"))).toEqual(["index", "amountCents", "category", "dateDays"]);
  });
});

describe("marketplace ABI", () => {
  it("has every function and event the live layer calls", () => {
    for (const n of ["buyListing", "withdraw", "getListing", "getListings", "listingsBySeller", "listingOfDataset", "purchasesByBuyer", "hasAccess", "sellerStats"]) {
      fn(d.market.abi, n);
    }
    const list = fn(d.market.abi, "listDataset");
    expect(list.inputs).toHaveLength(5);
    expect(list.inputs[4].name).toBe("categoryMask");
    expect(names(ev(d.market.abi, "Listed").inputs)).toEqual(expect.arrayContaining(["listingId", "seller", "priceWei", "title", "at"]));
    expect(names(ev(d.market.abi, "Purchased").inputs)).toEqual(expect.arrayContaining(["listingId", "buyer", "priceWei", "at"]));
    expect(names(ev(d.market.abi, "Withdrawn").inputs)).toEqual(expect.arrayContaining(["seller", "amountWei", "at"]));
  });
  it("keeps the listing tuple shape", () => {
    expect(tupleNames(fn(d.market.abi, "getListing"))).toEqual([
      "id", "datasetId", "seller", "title", "description", "priceWei", "recordCount", "categoryMask", "listedAt", "salesCount",
    ]);
  });
  it("declares every custom error that REVERT_REASONS names (the Marketplace ABI carries the registry's too)", () => {
    const errors = new Set(d.market.abi.filter((x) => x.type === "error").map((x) => (x as { name: string }).name));
    for (const key of Object.keys(REVERT_REASONS)) expect(errors.has(key), key).toBe(true);
  });
});
