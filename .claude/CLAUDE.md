<!-- GSD:project-start source:PROJECT.md -->

## Project

**Opaquely**

Opaquely is a privacy-preserving analytics marketplace built on Zama FHEVM. **Input users (sellers)** upload bills and receipts; OCR runs in the browser, the extracted fields are encrypted with FHEVM, computation runs on-chain over the ciphertexts, and the encrypted dataset is listed for sale. **Authenticated users (buyers)** connect a wallet and sign a purchase transaction paying test ETH into escrow, and the smart contract grants their wallet access to that dataset. Later, Concrete ML will run encrypted machine learning (spend categorization, anomaly/fraud detection, scoring/prediction), and buyers will decrypt only the resulting **insights**, never the raw bill values.

Built as a college minor project for a friend.

**Core Value:** A bill goes from image → browser OCR → FHEVM ciphertext → on-chain encrypted computation → marketplace listing → buyer purchase (escrowed ETH) → buyer's wallet granted access on-chain, and no plaintext bill data leaves the seller's browser.

### Constraints

- **Timeline**: Milestone 1 must demo on Friday 2026-10-30, roughly two days from project start, so scope is aggressively cut to the purchase flow
- **Tech stack**: Next.js + TypeScript (5.9.3) + Tailwind frontend; wagmi 2.19.5 + viem + RainbowKit 2.2.11 for wallets; Hardhat 3 + `@fhevm/hardhat-plugin-v3` 0.13.x + `@fhevm/solidity` 0.13.4 for contracts; `@zama-fhe/sdk` 3.7.1 (exact pin) for client-side encryption (the old `@zama-fhe/relayer-sdk` loses support 2026-11-06); Tesseract.js 7 for browser OCR; Python + Concrete ML 1.9 in WSL2/Docker (Milestone 2). Fallback if the new stack breaks: Hardhat 2 + plugin 0.4.2 + solidity 0.11.1 + relayer-sdk 0.4.x (the contract code ports between them)
- **Runtime**: Node 22.23.4+ required by plugin-v3
- **Local chain gotcha**: `@zama-fhe/sdk` `cleartext()` against `npx hardhat node` needs a chain override (gatewayChainId, verifying addresses, inputSignerPrivateKey). A working spike is in `.planning/reference/spike/e2e2.mjs`
- **Network**: local Hardhat with the FHEVM mock first, Sepolia second; ETH is test-only
- **Privacy**: raw bill plaintext must never leave the seller's browser
- **Team**: college minor project; readability and demo clarity matter more than production hardening

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## The one decision that matters: use the 0.13 generation, not the template's 0.4/0.11 generation

| | Old generation ("template" stack) | **New generation (use this)** |
|---|---|---|
| Hardhat | 2.28.x | **3.21.1** |
| Plugin | `@fhevm/hardhat-plugin@0.4.2` (marked deprecated in the fhevm-mocks 0.13.0 release notes) | **`@fhevm/hardhat-plugin-v3@0.13.1`** |
| Mock engine | `@fhevm/mock-utils` (removed in 0.13) | `@fhevm/host-contracts-cleartext@0.13.1` (real host contracts at production addresses, computing on cleartext) |
| Solidity lib | `@fhevm/solidity@0.11.1` | **`@fhevm/solidity@0.13.4`** |
| Browser SDK | `@zama-fhe/relayer-sdk@0.4.x` (Zama calls it legacy) | **`@zama-fhe/sdk@3.7.1`** (`cleartext()` for local, `web()` for Sepolia) |
| Frontend against local node | Browser mock via `mock-utils`: needed a postinstall patch of `node-tkms`, WASM files in `public/` and `fs` shims. Zama deleted all of it. | `cleartext()` relayer: no WASM, no KMS, no gateway |
- The old plugin's peer deps hard-pin `@fhevm/solidity ^0.11.1` and `@zama-fhe/relayer-sdk 0.4.1`. The only path to a browser frontend on the local node is the fragile patched `mock-utils` bundle.
- The Solidity API you will write is identical across generations. A diff of the `FHE.sol` function sets shows 0.13.4 only adds `sum` and `isIn`, so contract code is portable if you ever have to fall back. The Sepolia addresses in `ZamaConfig` are identical in 0.11.1 and 0.13.4, so Sepolia works with either.
- `hardhat node` in plugin-v3 deploys the cleartext FHEVM stack before it starts listening. This was verified in the spike, with the node printing `fhevm: cleartext FHEVM stack on 'node' (chainId 31337) ... verified`.

## Recommended Stack

### Contracts and local chain (Milestone 1)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Node.js | 22.23.4 (22 LTS) | Runtime | `@fhevm/hardhat-plugin-v3@0.13.1` declares `engines >=22.23.4`, and `@fhevm/sdk` and `@zama-fhe/sdk` need `>=22`. The dev machine runs 22.15.0. The spike passed on 22.15.0, but npm silently fell back to plugin 0.13.0 there. Upgrade to 22.23.4 first (5 minutes) so you get 0.13.1. | HIGH |
| Hardhat | 3.21.1 | Compile, test, local node, Sepolia deploy | Required by plugin-v3. ESM and TypeScript native config via `defineConfig`. | HIGH |
| `@nomicfoundation/hardhat-toolbox-mocha-ethers` | 4.0.0 | Mocha, chai, ethers, Ignition, typechain bundle for HH3 | The toolbox that plugin-v3's own README quickstart uses. | HIGH |
| `@fhevm/hardhat-plugin-v3` | 0.13.1 (0.13.0 if you stay on Node 22.15) | FHEVM on `network.connect()`: `fhevm.helpers.encryptUint32`, `decryptUint32`, `cleartextDb.*`; a `hardhat node` that serves the cleartext stack | The official mock. Register it with `plugins: [hardhatToolboxMochaEthers, fhevmPlugin]`. | HIGH |
| `@fhevm/solidity` | 0.13.4 | `FHE.*` library, `ZamaEthereumConfig`, encrypted types | npm `latest`. `ZamaEthereumConfig` auto-routes by `block.chainid` to mainnet, Sepolia, Polygon, Amoy or 31337. The old `SepoliaConfig` contract no longer exists. | HIGH |
| `encrypted-types` | 0.0.4 (transitive) | `euint8/16/32/64/128/256`, `ebool`, `eaddress`, `externalEuintXX` | Pulled in by `@fhevm/solidity`. Do not install it separately. | HIGH |
| `@fhevm/sdk` | 0.13.8 (devDependency) | Peer of plugin-v3 | Required peer (`^0.13.8`). Not used directly in your code. | HIGH |
| solc | 0.8.27, `evmVersion: "cancun"` | Compiler | What plugin-v3's README and the template use. FHEVM needs at least cancun. | HIGH |
| viem | 2.57.13 | Peer of plugin-v3 and used by the frontend | Plugin-v3 peers `viem ^2.55.19`. One viem version shared by both packages. | HIGH |
| TypeScript | 5.9.3 | Types | Pin to 5.9.x. `npm install typescript` resolved TS 7.0.2 in the spike. Next 16, wagmi and RainbowKit are only validated against 5.x. | MEDIUM |
- Import with `import {FHE, euint32, euint64, ebool, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";` and `import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";`. The contract does `contract X is ZamaEthereumConfig`.
- Inputs: a function takes `(externalEuint32 h, bytes calldata inputProof)` and calls `FHE.fromExternal(h, inputProof)`.
- Math: `FHE.add`, `sub`, `mul`, `div` and `rem` (plaintext divisor only), `min`, `max`, `neg`. New in 0.13: `FHE.sum`.
- Compare and branch: `FHE.gt`, `ge`, `lt`, `le` and `eq` return `ebool`. `FHE.select(ebool, a, b)` is the only branching construct.
- ACL: `FHE.allowThis(h)` (the contract needs it to reuse the handle in later transactions), `FHE.allow(h, addr)` (persistent), `FHE.allowTransient(h, addr)` (this transaction only, for contract-to-contract calls), `FHE.isAllowed`, `FHE.isSenderAllowed`.
- Public reveal: `FHE.makePubliclyDecryptable` with `FHE.checkSignatures`. The old Gateway `requestDecryption` and callback oracle no longer exist. Not needed for this project.

| Field | Type | Why |
|-------|------|-----|
| Amount in cents | `euint64` (or `euint32`, which holds up to about 42.9M cents) | Integers only. No floats and no encrypted division. |
| Category id | `euint8` | Small enum. Per-category totals use `FHE.select(FHE.eq(cat, k), amt, 0)`. |
| Date | `euint32` (days since epoch or yyyymmdd) | Keeps the ciphertext small. |
| Vendor | Not an encrypted string. Use a hashed or enum id as `euint64`, or keep it out of the encrypted set. | There is no encrypted string type. |
| Anomaly flag | `ebool` from `FHE.gt(amount, threshold)` | The threshold can be plaintext (cheaper). |

### Browser SDK (encrypt and, in Milestone 2, decrypt)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `@zama-fhe/sdk` | **3.7.1, pinned exactly** (no caret) | `sdk.encrypt(...)` and `sdk.decryption.decryptValues(...)`. `cleartext()` relayer for local, `web()` relayer for Sepolia. | Zama states this is the new default SDK and that `@zama-fhe/relayer-sdk` is legacy. Its `./viem`, `./chains`, `./web` and `./cleartext` exports were confirmed in the 3.7.1 package. It depends on `@fhevm/sdk@0.13.2`, the same generation as plugin-v3. The API changed a lot between 2.x and 3.x and again in 3.x minors (`SepoliaConfig` and `RelayerWeb` became `createConfig` and `web()`), so a caret range is a risk before a demo. | HIGH |
| `@zama-fhe/react-sdk` | Skip for now (3.7.1 exists) | React hooks (`useEncrypt`, `useDecryptValues`) | The core SDK is simpler to debug. Zama's own template had to vendor a local `WagmiSigner` because `react-sdk@3.0.0` imported a symbol wagmi does not export. Whether 3.7.1 fixed it is unverified. Wrap the core SDK in one small `useZama()` hook instead. | MEDIUM |
| `@zama-fhe/relayer-sdk` | Do not install | Legacy | Only plugin 0.4.2 needs it. | HIGH |
- `contractAddress` must be EIP-55 checksummed (use `viem.getAddress`). The relayer rejects lowercase addresses.
- Decrypt (Milestone 2): `sdk.decryption.decryptValues([{ encryptedValue: handle, contractAddress }])` builds the transport keypair and the EIP-712 permit and caches them. The caller must have `FHE.allow`ed on the handle.
- Wait for the receipt before reading a handle back, or you will read a stale zero handle.
- **Next.js and SSR:** never construct the SDK, a relayer, a storage or a signer at module level in a file the server imports. All of that must live in `"use client"` files, or behind `await import('@zama-fhe/sdk/web')`. Build the SDK in a `useMemo` or `useEffect` once `useWalletClient()` returns a client, because `createConfig` needs a wallet client. `web()` loads real WASM and a Web Worker (Sepolia only). `cleartext()` needs no WASM.
- **Do not set COOP/COEP headers** (`Cross-Origin-Embedder-Policy: require-corp`). Zama suggests them for multi-threaded WASM, but COEP breaks cross-origin wallet-modal and WalletConnect assets. Single-threaded encryption on Sepolia is fine for a demo.
- Sepolia needs no relayer API key (the testnet relayer is `https://relayer.testnet.zama.org`). The `sepolia` preset carries the contract addresses. Cleartext mode is blocked on Sepolia and mainnet by design.
- Real FHE input encryption on Sepolia (`web()`) downloads a large public key (about 50 MB at first init). Pre-warm it before demoing.

### Frontend

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Next.js | 16.4.3 (App Router) | App framework | npm `latest`. Zama's template used 15.2.3 with webpack. The `web()` Worker and WASM bundling under Turbopack (the default in 16) is untested. If `next dev` or `next build` fails on the SDK, use `next dev --webpack` and `next build --webpack`. If that also fails, drop to `next@15.5.28` (latest 15.x). Local cleartext mode has no WASM, so the Friday demo is unaffected either way. | MEDIUM |
| React / react-dom | 19.3.1 | UI | Next 16 and RainbowKit peers accept 19. | HIGH |
| Tailwind CSS | 4.3.3 with `@tailwindcss/postcss@4.3.3` | Styling | CSS-first config (`@import "tailwindcss"`) with no `tailwind.config.js` by default. Zama's template runs Tailwind 4. | HIGH |
| wagmi | **2.19.5 (stay on 2.x)** | Wallet and chain hooks | wagmi `latest` is 3.7.9, but `@rainbow-me/rainbowkit@2.2.11` peers `wagmi ^2.9.0`. Zama's template pins 2.19.5. `@zama-fhe/react-sdk` accepts `wagmi >=2`. | HIGH |
| viem | 2.57.13 | Chain client, ABI encoding, `getAddress` | Shared with the contract toolchain. | HIGH |
| `@rainbow-me/rainbowkit` | 2.2.11 | Connect button and modal | npm `latest`. It needs a free WalletConnect Cloud `projectId` in `getDefaultConfig`. For a local demo any non-empty string works with the injected wallet (MetaMask). | HIGH |
| `@tanstack/react-query` | 5.105.0 | Required by wagmi and RainbowKit | Zama's SDK also needs `>=5.96` for a mutation-callback signature, so do not go below that. | HIGH |
| `geist` | 1.8.2 | Geist Mono for the GradientASCII background | React Bits `GradientASCII` uses Geist Mono. Alternatively use `next/font/google` `Geist_Mono`. | MEDIUM |
| `eslint-config-next` | 16.4.3 | Lint | Keep it aligned with Next. | MEDIUM |
- Chains: wagmi `hardhat` (31337) and `sepolia`. Use `ssr: true` in the wagmi config and keep providers in a `"use client"` `providers.tsx`.
- Two roles in one demo: import Hardhat dev accounts #0 and #1 into MetaMask (private keys are printed by `npx hardhat node`), or use two browser profiles. After restarting the node, run MetaMask Settings, Advanced, "Clear activity tab data", or you get nonce errors.
- Role is chosen in the UI and stored off-chain. Access control is on-chain, so there is no auth server.

### Browser OCR

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `tesseract.js` | 7.0.0 | In-browser OCR of bill images | Latest (December 2025). It runs in a Web Worker, so the image never leaves the device. v7 `createWorker('eng', 1, opts)` returns only `text` by default. Pass `{ blocks: true }` in the output argument if you want word boxes. It needs `tesseract.js-core@^7` (resolved automatically). | HIGH |
- Call `createWorker` only from a `"use client"` component, inside `useEffect` or an event handler. Create one worker, reuse it, and call `worker.terminate()` on unmount.
- Privacy and demo caveat: by default Tesseract downloads `eng.traineddata.gz` and the core WASM from jsDelivr. That is model data, not user data, but the venue's Wi-Fi may be unreliable. Copy `node_modules/tesseract.js-core/*.wasm.js` (all four files) and the language file into `public/tesseract/`. Then set `corePath`, `langPath` and `workerPath` to local paths. Pass the whole `corePath` directory, never a single `.js` file.
- Accuracy on receipts: upscale the image to about 2x (canvas), convert to grayscale, and set PSM to 6 (single block) or 4 (single column). The seller-review step (editable fields) already exists in the requirements, and it is the right safety net. Parse the total with a regex for the largest currency-looking number near "total".
- Do not try to run Tesseract on PDFs. Convert pages to images first (pdf.js) or restrict uploads to images.

### Milestone 2: Concrete ML (off-chain encrypted inference)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `concrete-ml` | 1.9.0 (PyPI latest, released April 2025) | Train, compile, and run scikit-learn style models under TFHE | Latest release. The last 3 tags are 1.7.0, 1.8.0, 1.9.0, so the cadence is slow. Requires Python `>=3.8.1,<3.13`. | HIGH |
| Python | 3.12.x | Runtime | The dev machine's Python 3.12.10 is inside the supported range. | HIGH |
| `concrete-python` | 2.10.0 (pinned by concrete-ml) | FHE compiler (installed automatically) | Do not upgrade it independently. | HIGH |
| scikit-learn | 1.5.0 (pinned by concrete-ml) | Model training | Do not install the latest scikit-learn (1.9.x). Concrete ML hard-pins `1.5.0` and numpy `1.26.4`. | HIGH |
| FastAPI + uvicorn | 0.162.0 + 0.54.0 (latest, unpinned until Milestone 2) | HTTP wrapper around `FHEModelServer` | Small, async, trivial to run. Any web framework works. | MEDIUM |
- Dev machine: `model.fit(...)`, `model.compile(X)`, then `FHEModelDev(path_dir, model).save()`. That writes `client.zip` (crypto parameters and quantization) and `server.zip` (the compiled circuit). `server.zip` is architecture-specific, so a model compiled on x86 will not run on ARM.
- Server: `FHEModelServer(path_dir).load()` then `.run(encrypted_data, serialized_evaluation_keys)`.
- Client: `FHEModelClient(path_dir, key_dir)` provides `get_serialized_evaluation_keys()`, `quantize_encrypt_serialize(x)` and `deserialize_decrypt_dequantize(result)`.
- Classifiers return `predict_proba`-style output, so threshold on the client.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Contract toolchain | Hardhat 3.21.1 + plugin-v3 | Hardhat 2.28 + `@fhevm/hardhat-plugin@0.4.2` (the template) | Deprecated generation. The only path to a browser against local is the removed `mock-utils` hack. Keep it as a fallback only. |
| Contract toolchain | Hardhat 3 | Foundry + `@fhevm/forge` (Zama's current React template) | The official frontend template moved here. It needs `forge`, `anvil`, `jq` and bash scripts, which is heavy on Windows with a 1.5-day clock. The team's stack constraint is Hardhat. |
| Browser SDK | `@zama-fhe/sdk@3.7.1` core | `@zama-fhe/relayer-sdk@0.4.x` | Legacy. It would pull the browser mock with its patches. |
| Browser SDK | core SDK + small hook | `@zama-fhe/react-sdk` | Less proven with wagmi 2 (template needed a local signer shim). Revisit after Friday. |
| Wallet | wagmi 2.19.5 + RainbowKit 2.2.11 | wagmi 3.7.9 | RainbowKit 2.2.11 peers wagmi `^2.9.0`. Mixing them gives peer errors and runtime breakage. |
| OCR | Tesseract.js 7.0.0 | PaddleOCR through ONNX, or a transformers.js VLM | Higher accuracy but big weights and bundler risk. Milestone 2 candidate. |
| Escrow payment token | Plain ETH | ERC-7984 confidential token | Out of scope per PROJECT.md. |
| Hardhat deploy plugin | plain `hardhat run` script or Ignition | `hardhat-deploy` | `hardhat-deploy` only supports Hardhat 2. |

## What NOT to use

| Do not use | Why |
|------------|-----|
| `fhevmjs` (0.6.2, last published July 2025) | Replaced by the relayer SDK, then by `@zama-fhe/sdk`. Examples that import it use an API that no longer matches the on-chain version. |
| `fhevm` npm package and `TFHE.*` Solidity (v0.x era) | Replaced by `@fhevm/solidity` and the `FHE.*` library. Old tutorials show `TFHE.asEuint32`, `Gateway.requestDecryption` and `SepoliaZamaFHEVMConfig`. |
| `SepoliaConfig` contract | Gone in 0.13. Inherit `ZamaEthereumConfig`. |
| Gateway `requestDecryption` and callback oracles | Removed. User decryption is EIP-712 plus relayer. Public reveal is `makePubliclyDecryptable` plus `checkSignatures`. |
| `@fhevm/mock-utils`, `@fhevm/hardhat-plugin@0.4.x` | Removed or deprecated. They pin `@fhevm/solidity ^0.11.1`, so they conflict with 0.13.4. |
| `@zama-fhe/sdk@^3` with a caret, or `latest` | Minor releases have changed names and presets. Pin 3.7.1 and upgrade deliberately after the demo. A beta (3.8.0-beta.x) and an alpha (4.0.0-alpha.3) exist and are not stable. |
| wagmi 3.x | Incompatible with RainbowKit 2.2.11. |
| Server-side OCR or any API that receives bill images | Violates the core privacy requirement. |
| Native Windows `pip install concrete-ml` | Unsupported. Use WSL2 or Docker. |
| COOP/COEP headers for faster WASM | Breaks cross-origin wallet assets. |

## Installation

# 0. Upgrade Node to 22.23.4 (nvm-windows or the installer) - then verify

# 1. Contracts workspace

# smoke test: compile and run the APlusB example from the plugin-v3 README, then:

# 2. Frontend

# 3. Milestone 2 (WSL2 Ubuntu or the zamafhe/concrete-ml Docker image, NOT native Windows)

## Verification performed (so the roadmap can trust the numbers)

- npm latest and dist-tags were queried on 2026-10-29 for every package listed.
- Spike (scratchpad `spike/`, not part of the repo): Hardhat 3.21.1, plugin-v3 0.13.0, `@fhevm/sdk` 0.13.8, `@fhevm/solidity` 0.13.4 and solc 0.8.27 compiled `APlusB`. `npx hardhat test` passed (encrypt, add, user-decrypt equals 203) on Node 22.15.0.
- `npx hardhat node` started the cleartext stack. `eth_getCode` returned bytecode at the SDK `hardhat` preset's ACL (`0x50157C…`) and executor (`0xe3a910…`).
- `@zama-fhe/sdk@3.7.1` with `cleartext()` against that node: failed with the bare `hardhat` preset (signer mismatch). It succeeded with the chain override above (full encrypt, write, compute, `decryptValues` round trip returned 203). It was tested in Node, not in a browser.
- Not verified: browser bundling of `@zama-fhe/sdk` under Next 16 or Turbopack; the `web()` relayer on Sepolia; Hardhat 3 Sepolia deployment config; the `@zama-fhe/react-sdk` 3.7.1 wagmi signer fix; Concrete ML install (not possible on this Windows host).

## Sources

- npm registry metadata for `@fhevm/solidity`, `@fhevm/hardhat-plugin`, `@fhevm/hardhat-plugin-v3`, `@fhevm/host-contracts-cleartext`, `@fhevm/sdk`, `@zama-fhe/sdk`, `@zama-fhe/react-sdk`, `@zama-fhe/relayer-sdk`, `next`, `wagmi`, `@rainbow-me/rainbowkit`, `viem`, `hardhat`, `tesseract.js` (HIGH, primary registry).
- https://github.com/zama-ai/fhevm-mocks releases v0.13.0 and v0.13.1 (HIGH, official release notes on the generation switch).
- https://github.com/zama-ai/fhevm-hardhat-template (`package.json`, `hardhat.config.ts`, `FHECounter.sol`) (HIGH, shows the old generation).
- https://github.com/zama-ai/fhevm-react-template (`README.md`, `DappWrapperWithProviders.tsx`, commit history) (HIGH, shows Zama moved to Foundry, `@zama-fhe/sdk` v3 and `RelayerCleartext`).
- https://github.com/zama-ai/sdk, docs `guides/local-development`, `guides/nextjs-ssr`, `guides/encrypt-decrypt`, `reference/sdk/network-presets` (HIGH, official).
- `@fhevm/hardhat-plugin-v3@0.13.1` README (HIGH). `@fhevm/solidity@0.11.1` vs `0.13.4` package contents (HIGH, diffed locally).
- https://github.com/zama-ai/concrete-ml docs `getting-started/pip_installing.md` and `guides/client_server.md`, plus the PyPI JSON for `concrete-ml` (HIGH).
- Tesseract.js 7.0.0 `docs/api.md` and `docs/local-installation.md` through jsDelivr (HIGH). Next.js-specific Tesseract guidance is synthesized from those docs, with no Next-specific official source found (MEDIUM).

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-fast` for a trivial task inline, with no subagents and no PLAN.md
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
