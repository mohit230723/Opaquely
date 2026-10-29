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

`FheSpike` is the Phase 2 spike that proves the browser-to-contract encrypted path. Phase 3 replaces it with `DatasetRegistry` and `Marketplace`.

## Node version

This machine runs Node 22.15.0, so the plugin is pinned to 0.13.0. Plugin 0.13.1 declares `engines >=22.23.4`, so 0.13.1 needs Node 22.23.4 or later. Moving to it (install Node 22.23.4+, set the plugin to 0.13.1, reinstall, rerun the tests) is a manual follow-up for the owner and is not done in Phase 2.
