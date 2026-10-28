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
