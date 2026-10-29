# contracts

Opaquely's smart-contract workspace: Hardhat 3.21.1, `@fhevm/hardhat-plugin-v3` 0.13.0 and `@fhevm/solidity` 0.13.4 (the Zama 0.13 generation), compiled with solc 0.8.27 for the `cancun` EVM.

This is a separate npm project on purpose. It is not a root npm workspace, because `web/package.json` carries the `@coinbase/cdp-sdk` override and the Phase 1 pins, and a root workspace would force that override to move.

## Install

```bash
cd contracts
npm ci
```

Never use `--force` or `--legacy-peer-deps`. `npm` prints a high-severity audit notice for the Hardhat tree: ignore it and do not run `npm audit fix`.

## Test

```bash
npm test
```

The first run downloads solc 0.8.27 (about a minute). `FheSpike` encrypts 100 and 250, adds them on the local FHEVM mock and decrypts 350. The `hre.network.connect() is deprecated` warning is harmless.

## Local node

```bash
npm run node:start   # detached hardhat node on 127.0.0.1:8545, waits until the FHEVM ACL is deployed
npm run node:stop    # kills the whole process tree and confirms the port is free
```

The node log and pid file live in `../.scratch/` (`hardhat-node.log`, `hardhat-node.pid`). The node is bound to 127.0.0.1 only. Hardhat accounts #0 and #1 are the seller and buyer used by the web e2e harness.

After restarting the node, MetaMask needs Settings, Advanced, "Clear activity tab data", otherwise it reuses stale nonces.

## Contracts

`FheSpike` is the Phase 2 spike that proves the browser-to-contract encrypted path. It stays as the `/dev/fhe` smoke contract; the Phase 3 deploy does not deploy it.

## Node version

This machine runs Node 22.15.0, so the plugin is pinned to 0.13.0. Plugin 0.13.1 declares `engines >=22.23.4`, so 0.13.1 needs Node 22.23.4 or later. Moving to it (install Node 22.23.4+, set the plugin to 0.13.1, reinstall, rerun the tests) is a manual follow-up for the owner and is not done in Phase 2.

## Contracts (Phase 3)

Two contracts, deployed and linked by one command (see Deploy below).

### DatasetRegistry

Owns the encrypted bills, the FHE math, the ACL and the seal.

- The seller calls `addRecord(datasetId, amount euint64 cents, category euint8, date euint32, one inputProof)` directly on the registry, because the input proof binds (registry, seller). One proof covers all three values.
- Category ids: 0 Utilities, 1 Groceries/Food, 2 Medical, 3 Transport/Fuel, 4 Shopping, 5 Other. This is the same order as `web/src/lib/categories.ts`. Ids above 5 are clamped into Other.
- The anomaly threshold is 500000 cents, plaintext, set at deploy by `ANOMALY_THRESHOLD_CENTS`. `MIN_BILLS_TO_LIST` is 3 and `MAX_BILLS_PER_DATASET` is 50 (`TooManyBills(maximum)` on the 51st `addRecord`).
- Per-bill handles are decryptable by the seller only. After a purchase the buyer gets exactly 9 aggregate handles: 6 category totals, the grand total, the encrypted record count and the anomaly count.
- The vendor never goes on chain.
- `setMarketplace` is deployer-only and one-time. It rejects the zero address and any address without code (`InvalidMarketplace`), so a rejected call does not use up the one-shot.

### Marketplace

No FHE imports.

- `listDataset(datasetId, title, description, priceWei, categoryMask)` seals the dataset and lists it.
- `buyListing(listingId, expectedPriceWei)` needs `msg.value` equal to the price.
- `withdraw()` is a pull payment guarded by OpenZeppelin `ReentrancyGuard` 5.6.1 and checks-effects-interactions. Proceeds are "held until withdrawn", not escrow.

### Reads for the DataLayer (no indexer)

- `getListings` (newest first), `getListing`, `listingsBySeller`, `listingOfDataset`
- `purchasesByBuyer`, `hasAccess` (on both contracts), `sellerStats`
- `datasetsByOwner`, `getDataset`, `getBillHandles`, `getAggregates`
- The per-user views `datasetsByOwner`, `listingsBySeller` and `purchasesByBuyer` return the whole array with no paging. They are bounded by demo scale (one wallet, a handful of rows) and only the wallet's own actions can grow them. `getBillHandles` is bounded by `MAX_BILLS_PER_DATASET`. Only `getListings` is paged. Add `(offset, limit)` variants before any real deployment.
- Events `Listed`, `Purchased`, `Withdrawn` (each with a uint64 `at` timestamp), plus `DatasetCreated` and `RecordAdded`, queried from `deployBlock`. The purchase tx hash comes from the `Purchased` event.

### Deploy

```bash
npm run node:start      # fresh local FHEVM node on 8545
npm run deploy          # hardhat compile, deploy DatasetRegistry then Marketplace, link, export
npm run verify:deploy   # proves the exported file with viem: code, link, constants, error decoding
npm run node:stop
```

- The deploy writes `web/src/contracts/deployments.json` and `deployments.ts`, keyed by chain id. Both are generated and committed.
- On a fresh node one deploy always gives 0x5FbDB2315678afecb367f032d93F642f64180aa3 (DatasetRegistry) and 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 (Marketplace).
- A redeploy on a running node writes new addresses for that chain and keeps the other chain keys.
- Environment: `RPC_URL` (default http://127.0.0.1:8545), `DEPLOYER_PRIVATE_KEY` (environment only, never committed or written to any file; needed for a public RPC such as Sepolia in Phase 6), `ANOMALY_THRESHOLD_CENTS`. The flag `--out <dir>` changes the output directory.
- `verify:deploy` needs no unlocked account. It uses `eth_accounts` when the node has one (local node), otherwise the address of `DEPLOYER_PRIVATE_KEY` (only the address is used, as the sender of an `eth_call`; nothing is signed). With neither, it skips only the error-decode check and prints a note, so it also runs against public RPCs such as Sepolia.
- The registry's errors are merged into the exported Marketplace ABI, so viem decodes errors that bubble through `listDataset` by name.

### Custom errors (for Phase 5's `REVERT_REASONS`)

`web/src/lib/tx-errors.ts` is not edited in Phase 3. AlreadyPurchased, OwnListing and PriceChanged already have reasons in the web table.

- Marketplace: InvalidTitle, DescriptionTooLong, ZeroPrice, InvalidCategoryMask, ListingNotFound, OwnListing, AlreadyPurchased, PriceChanged, WrongPayment, NothingToWithdraw, TransferFailed
- DatasetRegistry: InvalidName, DatasetNotFound, NotDatasetOwner, DatasetIsSealed, TooFewBills, TooManyBills, OnlyMarketplace, NotDeployer, MarketplaceAlreadySet, InvalidMarketplace, NotSealed

### Measured costs on the local mock

- `addRecord`: about 2.75M to 3.0M gas and about 2.2M HCU with 356k depth, against limits of 20M and 5M per transaction. A wallet must not cap gas below about 3.2M.
- `buyListing` about 549k gas, `listDataset` about 292k.
- Sepolia numbers may differ.

### Privacy notes

- The dataset name, listing title, description and the seller-declared `categoryMask` are public plaintext. The mask is unverified.
- A category that holds exactly one bill has a total equal to that bill's amount. This is accepted for the demo (threat T-03-13).
- **Aggregates can reveal exact bill amounts (review WR-01, open decision).** The buyer decrypts 9 exact aggregates, and in small or sparse datasets those are not an aggregate in any useful sense:
  - With 6 fixed categories, a dataset of 3 bills in 3 different categories gives the buyer all three amounts exactly through `categoryTotals`. Any category with a single bill equals that bill.
  - A category with one bill also leaks that bill's anomaly status through `anomalyCount` and `recordCount`.
  - `anomalyCount == 0` or `anomalyCount == recordCount` pins every bill in the dataset below or above the threshold.
  - `MIN_BILLS_TO_LIST` (3) is a minimum row count, not k-anonymity or any differential-privacy guarantee. It does not stop the cases above, and it should not be described to sellers or buyers as a privacy floor.
  - The contract logic was deliberately not changed. Options when the owner decides: keep an encrypted per-category bill count and show the buyer `FHE.select(count_k >= K, total_k, 0)` with the raw totals seller-only, raise `MIN_BILLS_TO_LIST`, add a per-category minimum, or state the limit plainly in the seller listing form and the demo script.
- On the local node the cleartext mock sees input values. The UI labels it "Local FHEVM mock"; it is not real FHE.
