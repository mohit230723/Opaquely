import type { Dataset } from "./types";

/**
 * The seam Phases 4 and 5 swap for real contract and FHE calls.
 * Plan 01-04 adds createDataset; plan 01-07 adds the rest.
 */
export interface DataLayer {
  listMyDatasets(): Promise<Dataset[]>;
}
