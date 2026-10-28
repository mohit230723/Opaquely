import { beforeEach, describe, expect, it } from "vitest";
import { createStubDataLayer, resetStubStore, stubControls } from "./index";
import type { Hex } from "../types";

const SELLER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as Hex;
const FAST = { readMs: 0 };

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
