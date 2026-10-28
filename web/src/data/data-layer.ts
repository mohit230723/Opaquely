import type { Dataset, TxHandle } from "./types";

/**
 * The seam Phases 4 and 5 swap for real contract and FHE calls.
 * Plan 01-04 adds createDataset; plan 01-07 adds the rest.
 */
export interface DataLayer {
  listMyDatasets(): Promise<Dataset[]>;
  /** Resolves with the tx handle once signed; the dataset exists after handle.wait(), with createdId in the receipt. */
  createDataset(input: { name: string }): Promise<TxHandle>;
}
