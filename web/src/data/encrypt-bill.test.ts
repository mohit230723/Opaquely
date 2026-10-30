import { describe, expect, it, vi } from "vitest";
import { sendEncryptBill } from "./encrypt-bill";
import type { BillFields, TxHandle, TxReceipt } from "./types";

const fields: BillFields = { amountCents: 150780n, dateDays: 20744, category: 1 };

function handle(hash: `0x${string}`, receipt: Partial<TxReceipt> = {}): TxHandle {
  return {
    hash,
    wait: async () => ({ status: "success", blockNumber: 1n, ...receipt }),
  };
}

function fakeLayer(opts: { createdId?: string; addBill?: () => Promise<TxHandle> } = {}) {
  const createDataset = vi.fn(async (input: { name: string }) => {
    void input;
    return handle("0xc1", "createdId" in opts ? { createdId: opts.createdId } : { createdId: "new-1" });
  });
  const addBill = vi.fn(async (datasetId: string, bill: BillFields) => {
    void datasetId;
    void bill;
    return opts.addBill ? opts.addBill() : handle("0xa1");
  });
  return { createDataset, addBill };
}

describe("sendEncryptBill", () => {
  it("creates the dataset first when there is none, reports the id, then adds the bill to it", async () => {
    const layer = fakeLayer();
    const onCreated = vi.fn();
    const result = await sendEncryptBill(layer, { datasetId: null, name: "Groceries Q3", fields }, onCreated);

    expect(layer.createDataset).toHaveBeenCalledTimes(1);
    expect(layer.createDataset).toHaveBeenCalledWith({ name: "Groceries Q3" });
    expect(onCreated).toHaveBeenCalledWith("new-1");
    expect(layer.addBill).toHaveBeenCalledTimes(1);
    expect(layer.addBill).toHaveBeenCalledWith("new-1", fields);
    expect(result.hash).toBe("0xa1");
    // The create is reported before the bill is sent, so a failed addBill can be retried without a second create.
    expect(onCreated.mock.invocationCallOrder[0]).toBeLessThan(layer.addBill.mock.invocationCallOrder[0]);
  });

  it("never creates a dataset when one exists, and adds the bill to it", async () => {
    const layer = fakeLayer();
    const onCreated = vi.fn();
    const result = await sendEncryptBill(layer, { datasetId: "d1", name: "Groceries Q3", fields }, onCreated);

    expect(layer.createDataset).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
    expect(layer.addBill).toHaveBeenCalledWith("d1", fields);
    expect(result.hash).toBe("0xa1");
  });

  it("passes only amount, date and category to addBill, never the vendor", async () => {
    const layer = fakeLayer();
    const draftLike = { ...fields, vendor: "SHREE GANESH SUPER MART" };
    await sendEncryptBill(layer, { datasetId: "d1", name: "n", fields: draftLike }, () => {});
    const sent = layer.addBill.mock.calls[0][1];
    expect(Object.keys(sent).sort()).toEqual(["amountCents", "category", "dateDays"]);
  });

  it("throws when the create receipt has no dataset id, and does not add the bill", async () => {
    const layer = fakeLayer({ createdId: undefined });
    const onCreated = vi.fn();
    await expect(sendEncryptBill(layer, { datasetId: null, name: "n", fields }, onCreated)).rejects.toThrow(
      /dataset id was not returned/i,
    );
    expect(onCreated).not.toHaveBeenCalled();
    expect(layer.addBill).not.toHaveBeenCalled();
  });

  it("keeps the created id when addBill rejects after a successful create, and propagates the rejection", async () => {
    const layer = fakeLayer({
      addBill: async () => {
        throw new Error("User rejected the request.");
      },
    });
    const onCreated = vi.fn();
    await expect(sendEncryptBill(layer, { datasetId: null, name: "n", fields }, onCreated)).rejects.toThrow(
      "User rejected the request.",
    );
    expect(onCreated).toHaveBeenCalledWith("new-1");

    // The retry carries the reported id, so it skips the create.
    await sendEncryptBill(layer, { datasetId: "new-1", name: "n", fields }, onCreated).catch(() => {});
    expect(layer.createDataset).toHaveBeenCalledTimes(1);
  });

  it("trims the dataset name before creating", async () => {
    const layer = fakeLayer();
    await sendEncryptBill(layer, { datasetId: null, name: "  Groceries Q3  ", fields }, () => {});
    expect(layer.createDataset).toHaveBeenCalledWith({ name: "Groceries Q3" });
  });
});
