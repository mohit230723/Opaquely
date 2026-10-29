# Opaquely web

Next.js 16 app for the Opaquely marketplace UI. In Phase 1 every dataset, listing and transaction is simulated by an in-memory stub behind one typed `DataLayer` interface (`src/data/data-layer.ts`); nothing is sent to a chain. Later phases swap the stub for real contract and FHE calls without touching the screens.

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

`npm run guardrails` (part of `npm run check`) fails on exact-pin drift, on `@coinbase/cdp-sdk` other than 1.52.0, on browser storage outside `role.ts`, on `sessionStorage`, `indexedDB`, network-send APIs, raw HTML injection and on COOP/COEP headers. FHE SDK imports are allowed only in `src/lib/zama.ts` and `src/lib/fhe.ts`, and even there a static value import of `@zama-fhe/*` is rejected (`sdk-static-import`). OCR imports stay rejected until Phase 4.

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
