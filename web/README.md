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

`npm run guardrails` (part of `npm run check`) fails on exact-pin drift, on `@coinbase/cdp-sdk` other than 1.52.0, on browser storage outside `role.ts`, on `sessionStorage`, `indexedDB`, network-send APIs, raw HTML injection, FHE-SDK or OCR imports (until a later phase allow-lists specific files) and on COOP/COEP headers.
