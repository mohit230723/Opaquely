# Opaquely

Opaquely is a privacy-preserving analytics marketplace built on Zama FHEVM. A seller uploads bills and receipts, the text is read in the browser (OCR), the extracted fields are encrypted with FHEVM, and the encrypted dataset is listed for sale. A buyer connects a wallet, pays test ETH into escrow, and the smart contract grants that wallet access to the dataset. Later milestones add encrypted machine learning over the datasets.

It is a college minor project. Readability and demo clarity matter more than production hardening.

Layout:

- `contracts/` has the Hardhat 3 project, the FHEVM contracts and the local node and deploy scripts. See [contracts/README.md](contracts/README.md).
- `web/` has the Next.js app and the headless Chrome end-to-end tests. See [web/README.md](web/README.md).
- `scripts/` has `demo-rehearse.mjs`, the one-command rehearsal of the whole demo.

## Demo runbook (local, the Friday path)

1. **Prerequisites.** Node 22 (22.15.0 works; the toolchain is locked on `@fhevm/hardhat-plugin-v3` 0.13.0), Chrome and MetaMask. Then install both packages:

   ```
   npm --prefix contracts ci
   npm --prefix web ci
   ```

2. **One-command rehearsal.** From the repo root:

   ```
   node scripts/demo-rehearse.mjs
   npm --prefix web run demo:rehearse
   ```

   Both do the same thing. Flags:

   - `--skip-build` reuses the production build, but only a build that the rehearsal itself made and that contains the freshly deployed contract address. Any other build is rebuilt, and the reason is printed.
   - `--full` runs the whole end-to-end suite after the golden path, not just the demo scripts.
   - `--port N` picks the port for the test web server (default 3180).

   With npm, put the flags after `--`, for example `npm --prefix web run demo:rehearse -- --skip-build`.

   The rehearsal stops any local node that this tooling started, starts a fresh one, deploys the contracts once, verifies the deploy, builds the app, and then drives a seller wallet and a buyer wallet through the real flow in headless Chrome: three sample bills read by OCR, encrypted and added, the dataset listed at 0.05 ETH, the buyer paying and getting access, the seller's open dashboard catching the sale, and the seller withdrawing. It ends with the line `DEMO REHEARSAL OK`, or `DEMO REHEARSAL FAILED at step N` with a plain reason.

   It only stops a node that `contracts/scripts/dev-node.mjs` started. If something else answers on 127.0.0.1:8545 it stops at step 2 and leaves that process alone. It restores the two generated deployments files only when the sole change is the `deployedAt` time. The log is written to `.scratch/rehearsal-<timestamp>.log`. A run with a build takes about 8 to 14 minutes; a run that can skip the build is much shorter.

3. **Start the real demo.**

   ```
   node contracts/scripts/dev-node.mjs start
   npm --prefix contracts run deploy
   npm --prefix web run build
   npm --prefix web run start
   ```

   Use the production build (`start`), not `next dev`. The deploy rewrites `web/src/contracts/deployments.json` and `deployments.ts`. If only the `deployedAt` time changed, put them back with `git checkout -- web/src/contracts/deployments.json web/src/contracts/deployments.ts`.

4. **MetaMask, two Chrome profiles** (one seller, one buyer):

   1. Create two Chrome profiles and install MetaMask in each.
   2. Add a network in each: RPC URL `http://127.0.0.1:8545`, chain id `31337`, currency symbol `ETH`.
   3. Import Hardhat account #0 in the seller profile and account #1 in the buyer profile. `hardhat node` prints the private keys. They are public test keys: never fund them on a real chain.
   4. Open the app in each profile and choose the role (seller or buyer) in the app.

   **After EVERY node restart, in both profiles: MetaMask, Settings, Advanced, "Clear activity tab data". Then redeploy and reload the app.** Without it MetaMask keeps the old nonces and every transaction fails. If a red banner says the contracts are not on this chain, the node was restarted without a redeploy.

5. **What the local mock does and does not hide.** The local chain runs the FHEVM mock (`cleartext()`). The node sees the amount, date and category in cleartext (the amount is in the `addRecord` calldata). The bill image, the OCR text and the vendor never leave the browser. This is **not real FHE**, so never enter a real bill: use the sample bills or made-up values. Real FHE is the Sepolia path.

6. **Freeze and backup.** Freeze the code about 3 hours before the demo and record a backup screen recording. Tagging `demo-v1` is the user's decision, and no script does it.

## What the rehearsal's privacy audit checks

The rehearsal watches both browser pages (seller and buyer) with one helper, `web/e2e/helpers/privacy-audit.mjs`. It fails the run on any of these 12 findings:

1. `network-origin`: a request attempt to anything except the app, the node RPC, or the two wallet-library hosts below.
2. `post-target`: a POST anywhere except the node RPC and `pulse.walletconnect.org`.
3. `marker-request`: a bill marker (vendor, amount text, PNG header, OCR-only line) in any request URL or body.
4. `marker-console`: a marker in any console line.
5. `marker-pageerror`: a marker in any page error.
6. `marker-body`: a marker in the buyer's page text. The seller's own tab shows the seller's own values on purpose, so its text is not scanned.
7. `storage-key`: a localStorage or sessionStorage key outside the wallet and role allow-list.
8. `marker-storage`: a marker in any storage value.
9. `idb-name`: an IndexedDB database outside the two wallet databases.
10. `marker-idb`: a marker in any IndexedDB record.
11. `failed-request`: a failed OCR, sample or app request.
12. `websocket-host`: a WebSocket to any host but the app or the node.

The measured allow-list is the app origin, the node RPC, `https://pulse.walletconnect.org` (POST) and `https://api.web3modal.org` (GET). Both wallet hosts are aborted by the test runner, so nothing is actually sent. A helper that cannot fail proves nothing, so it has a self-test that seeds one leak of each kind and checks that all 12 checks fire and that a clean page stays quiet:

```
node web/e2e/helpers/privacy-audit.mjs --self-test
```

## Sepolia (manual runbook, not run by any script)

This is ROADMAP criterion 3 and LAND-03. The code side is built and tested, but the live run needs the owner's own funded Sepolia key, so no script and no automated run touches Sepolia. **LAND-03 stays pending until the owner completes these steps.** Until then, every normal build is the local demo: Sepolia is off unless `NEXT_PUBLIC_ENABLE_SEPOLIA` is exactly `1` and a Sepolia entry exists in `web/src/contracts/deployments.json`.

1. **Faucet.** Get Sepolia test ETH for the deployer and for both demo wallets (seller and buyer). At least 0.2 test ETH on the deployer and on the seller is a reasonable estimate.
2. **Clean build.** In `contracts/`, run `npx hardhat clean`, then `npx hardhat compile`.
3. **Deploy, key from the shell only.** Set `RPC_URL` (for example the keyless `https://ethereum-sepolia-rpc.publicnode.com`) and `DEPLOYER_PRIVATE_KEY` in your shell, never in a file. Then run `npm --prefix contracts run deploy`. For any chain other than 31337 the script first prints `deploy target: chain 11155111, deployer <address>, balance <n> ETH` and refuses an empty balance before sending anything. The `11155111` entry is merged next to `31337` in `web/src/contracts/deployments.json`.
4. **Verify the deploy.** With the same environment, `node contracts/scripts/verify-deploy.mjs --keep 31337` must print `DEPLOY VERIFIED chain=11155111`.
5. **Build with the flag.** Set `NEXT_PUBLIC_ENABLE_SEPOLIA=1` (and optionally `NEXT_PUBLIC_SEPOLIA_RPC_URL`, keyless only: every `NEXT_PUBLIC_` value is visible in the page), then run `npm --prefix web run build` and `npm --prefix web run start`.
6. **Wallet and pre-warm.** Switch MetaMask to Sepolia. The header badge must read `Sepolia, real FHE`. If you restarted a local node earlier, use MetaMask, Settings, Advanced, "Clear activity tab data" first. Real encryption downloads a public key of roughly 50 MB the first time, so pre-warm it: add one bill earlier the same day, in the same browser profile.
7. **Run the flow.** Seller path (create a dataset, add 3 bills, list), buyer path (buy, `Access granted`), then withdraw.
8. **Audit the network.** In DevTools, record the relayer and key-download hosts, pass them as `extraAllowedOrigins` to `createPrivacyAudit` in `web/e2e/helpers/privacy-audit.mjs`, and confirm that no image, OCR text or vendor appears in any request, console line, storage or IndexedDB.
9. **If the worker or WASM fails** (a console warning or `EncryptOffloadUnavailableError`): change the Sepolia branch in `web/src/lib/zama.ts` to `web({ offloadEncrypt: false })`. If the build itself fails, use `next build --webpack` and `next dev --webpack`, and as a last resort `next@15.5.28`.
10. **Return to local.** Unset the flag and rebuild. The Sepolia entry is inert without the flag. The rehearsal (`npm --prefix web run demo:rehearse`) always builds with the flag off.

**Keys.** `DEPLOYER_PRIVATE_KEY` lives in the shell environment only. It is never written to a file, never committed, never put in a `NEXT_PUBLIC_` variable, and never printed by the deploy script.
