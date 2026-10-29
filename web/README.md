# Opaquely web

Next.js 16 app for the Opaquely marketplace UI. A typed in-memory stub and a chain-backed live layer sit behind one `DataLayer` interface (`src/data/data-layer.ts`), and the app picks one at runtime (see "Live seller pipeline (Phase 4)"). The screens do not know which one they are talking to.

## Install

```bash
npm ci
```

Versions are pinned exactly and `package-lock.json` is committed. `package.json` pins `@coinbase/cdp-sdk` to 1.52.0 through npm `overrides`; without it `next build` fails on missing `@x402/*` packages. Do not use `--legacy-peer-deps` or `--force`, and do not run `npm audit fix --force` (it proposes wagmi 3, which is not compatible with RainbowKit 2.2.11).

## Run

```bash
npm run dev                       # development
npm run build && npm run start    # production build
```

## Test

```bash
npm run check    # tsc, eslint, vitest and the guardrails scan
npm run e2e      # headless Chrome against `next start` (run `npm run build` first)
```

`npm run e2e` takes `--port <n>` (default 3100) and optional script names, for example `node e2e/run-all.mjs --port 3105 smoke`. The port must be free. The e2e scripts use an injected EIP-6963 test wallet instead of MetaMask and block every network request that is not local.

## Wallet connection

Copy `.env.local.example` to `.env.local` and set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` to a free project id from https://cloud.reown.com. This is optional: without it the app falls back to `demo-project-id`, which works for an injected wallet such as MetaMask but logs a harmless Reown warning in the console.

## Data layer

Screens read data only through `useDataLayer()` and the hooks in `src/data/hooks.ts`. ESLint rejects imports from `@/data/stub` everywhere except `src/data/provider.tsx`.

## Roles and guardrails

The Seller or Buyer role is a UI view mode stored per wallet address in this browser (`opaquely:role:<lowercase address>`). It is not a security boundary: nothing secret sits behind it, and real authorization is on-chain in later phases. `src/lib/role.ts` is the only module allowed to touch browser storage.

`npm run guardrails` (part of `npm run check`) fails on exact-pin drift, on `@coinbase/cdp-sdk` other than 1.52.0, on browser storage outside `role.ts`, on `sessionStorage`, `indexedDB`, network-send APIs, raw HTML injection and on COOP/COEP headers. FHE SDK imports are allowed only in `src/lib/zama.ts` and `src/lib/fhe.ts`, and even there a static value import of `@zama-fhe/*` is rejected (`sdk-static-import`). `tesseract.js` may be imported only in `src/lib/ocr.ts`, under the same no-static-import rule as the FHE SDK.

## FHE (Phase 2 spike)

`@zama-fhe/sdk` is pinned exactly to 3.7.1. Only `src/lib/zama.ts` and `src/lib/fhe.ts` touch it, through `import type` and dynamic `import()` inside async functions, and every caller goes through `getFhevm(chainId)`. The guardrails enforce both the allow-list and the no-static-import rule, so the server render never evaluates the SDK.

Local mode uses the `cleartext()` relayer with a chain override, so the local node sees inputs in cleartext. The page says "Local FHEVM mock" for that reason. It is never real FHE, and no real bill data should be entered. `getFhevm` refuses every chain other than 31337 in this phase.

The dev page is `/dev/fhe?address=<FheSpike address>`. It encrypts an amount in the browser, asks the wallet to sign `submit` on the spike contract and shows the handle and tx hash.

In `npm run dev` the page is always available. In a production build (`next start`) `/dev/fhe` returns 404 unless the server is started with `ENABLE_DEV_FHE=1` in its environment. The flag is read at request time, so no rebuild is needed (it is deliberately not a `NEXT_PUBLIC_` variable, which Next inlines at build time). `e2e/run-all.mjs` sets it for the `next start` it launches; to open the page by hand on a production build, run `ENABLE_DEV_FHE=1 npm run start`.

Gate commands, in order (from `web/`):

```bash
node ../contracts/scripts/dev-node.mjs start
npm --prefix ../contracts run compile
npm run build
node e2e/run-all.mjs --port 3120 fhe-spike
node ../contracts/scripts/dev-node.mjs stop
```

The fhe-spike script needs the node. When to run it:

- Named explicitly (`node e2e/run-all.mjs fhe-spike`): it runs, and it FAILS if nothing answers on 127.0.0.1:8545.
- Unfiltered run (`node e2e/run-all.mjs`): it runs only when a node answers on 8545. With no node the runner prints `SKIP fhe-spike (no node)` and the Phase 1 scripts still decide `E2E OK`.
- `E2E_ALLOW_SKIP_FHE=1` makes a named run skip (SKIP line, exit 0) instead of fail when there is no node. Leave it unset for a sign-off run.

The script deploys FheSpike and prints its address in the "FHE SPIKE OK contract=..." line.

Open `next dev` at http://localhost:PORT, not http://127.0.0.1:PORT. Next 16 blocks its dev resources for the 127.0.0.1 origin and the page never hydrates.

## Live seller pipeline (Phase 4)

### Data source

The app uses the live (chain-backed) layer when the wallet is on chain 31337 and `src/contracts/deployments.ts` has a 31337 entry; otherwise it uses the stub. A build with `NEXT_PUBLIC_OPAQUELY_DATA=stub` always uses the stub, which is how to demo with no node. It is a build-time variable, so rebuild after changing it. The e2e harness sets `window.__OPAQUELY_DATA` before the app loads ("stub" by default, "chain" for `seller-live`), and the window value wins over the env flag. Query keys include the source, so stub and live results never share a cache entry.

### What the seller path does

- Create dataset: the id comes from the `DatasetCreated` log of the transaction.
- Add bill: one `sdk.encrypt` call encrypts the amount (euint64 cents), the category (euint8) and the date (euint32 days) under one proof, then one `addRecord` transaction costs about 2.7M to 3.0M gas. A wallet must not cap gas below about 3.2M.
- Chain view: the values typed in this tab are shown beside the real ciphertext handles.
- List: seals the dataset (no more bills) and creates the marketplace listing.

The category mask on the listing is declared from the bills this tab added, so it is 0 after a reload. The vendor never goes on chain.

### OCR

Bills are read by Tesseract.js 7.0.0 in a Web Worker. Every asset is self-hosted in `public/tesseract/` (provenance and sha256 in `public/tesseract/README.md`, kept byte-exact by `.gitattributes`). The worker is created with `cacheMethod: "none"` so nothing is cached in IndexedDB, and the image is passed as a canvas so tesseract makes no fetch. OCR only pre-fills the review form, and manual entry always works.

Three synthetic sample bills are in `public/samples/`, generated by `scripts/gen-sample-bills.mjs`. They contain no real data. Regenerating them requires recapturing `src/lib/parse-receipt.fixtures.ts`.

### What the Local FHEVM mock hides, and what it does not

The image, the OCR text and the vendor never leave the browser; `seller-live` audits every request and console line for them. But under `cleartext()` the local node receives the amount, date and category in cleartext, and the amount is visible in the `addRecord` calldata. Never enter a real bill on the local mock. Real FHE needs the Sepolia `web()` relayer (Phase 6).

### Gate commands

From the repo root, in order:

```bash
node contracts/scripts/dev-node.mjs start
npm --prefix contracts run deploy
npm --prefix web run build
node web/e2e/run-all.mjs --port <free port> seller-live seller-ocr
node contracts/scripts/dev-node.mjs stop
```

Then restore the `deployedAt`-only change with `git checkout -- web/src/contracts/deployments.json web/src/contracts/deployments.ts`. The live integration test runs inside `npm run test` only when a node answers on 8545. An unfiltered e2e run with no node prints `SKIP fhe-spike (no node)` and `SKIP seller-live (no node)`.

### Known limits

The category mask is seller-declared and unverified, and small datasets can reveal exact amounts through the aggregates (review WR-01, an open decision). See "Privacy notes" in `../contracts/README.md`.

## Live marketplace (Phase 5)

### Buyer path on the chain

Listings come from `getListings` (read in pages) and are filtered in the browser by search text, category and minimum price. Buy simulates `buyListing(id, price)` first and then sends exactly the listed price. "Access granted" is always read from `hasAccess` and never inferred from a transaction result. My purchases come from `purchasesByBuyer`, and the tx hash on each row comes from the `Purchased` event. The seller dashboard reads `datasetsByOwner` and `sellerStats`. Withdraw is a pull payment: the seller takes the whole pending amount in one transaction. The activity timeline reads the `Listed`, `Purchased` and `Withdrawn` events from `deployBlock`. The seller's balance is held until withdrawn, not escrow: there is no refund and no release step.

### Two wallets side by side

On the chain, the reads that another wallet can change poll every 4 s (`src/data/polling.ts`), so a seller profile and a buyer profile in two windows stay in sync without a reload. The stub data layer never polls. A failed buy re-reads access at once, so a stale tab that hits "You already own this dataset." flips to "Access granted" immediately.

### Where each rejection is proven

- Double buy: in the browser with a stale second tab (`buyer-live`), and in the integration test.
- Own listing: the browser shows a disabled Buy button and the message; the `OwnListing` revert is proven in `src/data/live/live.integration.test.ts`.
- A stale price and a wrong payment: only in the integration test, because the UI always pays the listed price and a price cannot change on chain.

### Categories

Categories on a listing are declared by the seller and not verified. "Categories not declared by the seller" means the seller listed from a tab that did not hold every bill, so the mask is 0.

### Seed helper

`node web/e2e/helpers/seed-listing.mjs --self-check` seeds two listings on a running local node (create dataset, three encrypted bills, list) and reads them back. It signs with the public Hardhat key #0 and refuses any chain other than 31337. `buyer-live` imports the same `seedListing` function.

### Gate commands

From the repo root, in order:

```bash
node contracts/scripts/dev-node.mjs start
npm --prefix contracts run deploy
npm --prefix web run build
node web/e2e/run-all.mjs --port <free port> buyer-live
node contracts/scripts/dev-node.mjs stop
```

Then restore the `deployedAt`-only change with `git checkout -- web/src/contracts/deployments.json web/src/contracts/deployments.ts`. `buyer-live` drives five browser contexts (buyer, a stale tab of the buyer, Hardhat #2 as an outsider, the seller with a buyer role, and the seller's dashboard) and needs a fresh node with the contracts deployed. An unfiltered run with no node prints `SKIP buyer-live (no node)`, next to the fhe-spike and seller-live skips.

### Known limits for Phase 6

After a node restart, redeploy: the app does not detect an address that has no code. On Sepolia, a read right after a receipt may need pinning to the receipt block, and public RPCs cap the block range of `eth_getLogs`, so the activity timeline will need chunked reads.
