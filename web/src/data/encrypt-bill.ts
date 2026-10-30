import type { DataLayer } from "./data-layer";
import type { BillFields, TxHandle } from "./types";

export interface EncryptBillInput {
  /** The dataset to add to, or null before the first Encrypt (the dataset is created first). */
  datasetId: string | null;
  /** The dataset name, used only when the dataset is created. */
  name: string;
  /** Amount, date and category. Anything else on the object is dropped here, so the vendor never reaches the layer. */
  fields: BillFields;
}

/**
 * A dataset-create transaction that was sent but whose wait failed (a dropped connection, say). The caller keeps
 * it between attempts so a retry waits on the same transaction instead of creating a second dataset.
 */
export interface PendingCreate {
  /** The create sent by an earlier attempt, if its outcome is still unknown. */
  handle?: TxHandle | null;
  /** Reports a create as soon as it is sent, and null once it is known to have created nothing (reverted). */
  onSent?: (handle: TxHandle | null) => void;
}

/**
 * One Encrypt press: create the dataset when there is none yet, then add the bill to it.
 *
 * The new id is reported through onCreated as soon as the create is confirmed and before the bill is sent, so a
 * failed or rejected addBill keeps the dataset and a retry skips the create (no orphan datasets). The returned
 * handle is the addBill transaction's, so a failure that carries a hash always means the bill itself was sent.
 */
export async function sendEncryptBill(
  layer: Pick<DataLayer, "createDataset" | "addBill">,
  input: EncryptBillInput,
  onCreated: (id: string) => void,
  pending: PendingCreate = {},
): Promise<TxHandle> {
  let datasetId = input.datasetId;
  if (datasetId === null) {
    // A create that was sent by an earlier attempt is waited on again, never sent a second time.
    let created = pending.handle ?? null;
    if (!created) {
      created = await layer.createDataset({ name: input.name.trim() });
      pending.onSent?.(created);
    }
    const receipt = await created.wait();
    if (receipt.status === "reverted") {
      // Nothing was created, so the next attempt may send a fresh create.
      pending.onSent?.(null);
      throw new Error("Creating the dataset was reverted.");
    }
    if (!receipt.createdId) throw new Error("The dataset was created but its dataset id was not returned. Reload My Datasets before you try again.");
    datasetId = receipt.createdId;
    onCreated(datasetId);
  }
  const { amountCents, dateDays, category } = input.fields;
  return layer.addBill(datasetId, { amountCents, dateDays, category });
}
