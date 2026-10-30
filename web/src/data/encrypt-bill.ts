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
): Promise<TxHandle> {
  let datasetId = input.datasetId;
  if (datasetId === null) {
    const created = await layer.createDataset({ name: input.name.trim() });
    const receipt = await created.wait();
    if (receipt.status === "reverted") throw new Error("Creating the dataset was reverted.");
    if (!receipt.createdId) throw new Error("The dataset was created but its dataset id was not returned. Reload My Datasets before you try again.");
    datasetId = receipt.createdId;
    onCreated(datasetId);
  }
  const { amountCents, dateDays, category } = input.fields;
  return layer.addBill(datasetId, { amountCents, dateDays, category });
}
