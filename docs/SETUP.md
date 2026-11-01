# Setting up Opaquely

This guide takes a fresh Windows machine to a working Opaquely: the contracts, the web app, real FHE on Sepolia, and the Concrete ML stack. Each part builds on the one before it, so go in order. Parts 4 and 5 are optional: skip them if you only need the local demo.

| Part | What you get | Needed for |
|---|---|---|
| 1. Tools | Node, Git, Chrome, MetaMask | everything |
| 2. Code | the repo and its dependencies | everything |
| 3. Local demo | Hardhat node + mock FHE + the app | the offline demo |
| 4. Sepolia | real FHE, on a public test network | the "real FHE" demo |
| 5. Encrypted ML | Concrete ML in Docker | forecasts and anomaly scores |
| 6. Checks | tests and the one-command rehearsal | before any demo |

---

## 1. Install the tools

1. **Node.js 22** from https://nodejs.org (22.15.0 or newer in the 22 line). Check:
   ```bash
   node -v
   ```
2. **Git** from https://git-scm.com.
3. **Google Chrome**, plus the **MetaMask** extension. Use two Chrome profiles, one for the seller and one for the buyer, with MetaMask in each.
4. For Part 5 only: **Docker Desktop** (WSL 2 backend) from https://www.docker.com/products/docker-desktop. It needs about 4 GB of disk for the ML image; see Part 5 before installing if C: is short on space.

## 2. Get the code

```bash
git clone https://github.com/mohit230723/Opaquely.git
```
```bash
cd Opaquely
```
```bash
git checkout gsd/milestone-1
```

The latest work (Sepolia redeploy, encrypted ML, analytics dashboard) is on `gsd/milestone-1`. Use `main` only once that branch has been merged.

Install both packages. Versions are pinned exactly; never add `--force` or `--legacy-peer-deps`:

```bash
npm --prefix contracts ci
```
```bash
npm --prefix web ci
```

## 3. Run the local demo (mock FHE, no internet needed)

The local chain runs Zama's FHEVM **mock**: the node sees amount, date and category in cleartext. Only use the sample bills or made-up values here.

1. Start the local chain and deploy the contracts:
   ```bash
   node contracts/scripts/dev-node.mjs start
   ```
   ```bash
   npm --prefix contracts run deploy
   ```
   The deploy rewrites `web/src/contracts/deployments.json` and `deployments.ts` with the local addresses.
2. Build and start the app (use the production build for demos):
   ```bash
   npm --prefix web run build
   ```
   ```bash
   npm --prefix web run start
   ```
   Open http://localhost:3000.
3. Set up MetaMask in **both** Chrome profiles:
   1. Add a network: RPC URL `http://127.0.0.1:8545`, chain id `31337`, symbol `ETH`.
   2. Import Hardhat account #0 in the seller profile and account #1 in the buyer profile. `hardhat node` prints their private keys. They are public test keys: never send real funds to them.
4. Walk the flow: seller uploads a sample bill (OCR runs in the browser), encrypts it, lists the dataset; buyer buys it and gets "Access granted"; both open **View Analytics**.

After **every** node restart: in both profiles, MetaMask → Settings → Advanced → **Clear activity tab data**, then run the deploy again and reload the app. Otherwise every transaction fails with a nonce error.

To stop the node:
```bash
node contracts/scripts/dev-node.mjs stop
```

## 4. Turn on real FHE (Sepolia)

On Sepolia the browser does real TFHE encryption and Zama's network computes on ciphertexts. **The contracts are already deployed there** and their addresses are committed in `web/src/contracts/deployments.json`:

| Contract | Sepolia address |
|---|---|
| DatasetRegistry | `0xC8afA45f6599E4A63713a9f18118aE9B03520513` |
| Marketplace | `0xcfB0Ea6F41fde50ED98cceB07D655F96AE791ccc` |

1. Get Sepolia test ETH for a seller wallet and a buyer wallet (your own MetaMask accounts, not the Hardhat keys). About 0.1 ETH each is plenty. Faucets: Google Cloud Web3 faucet, Alchemy, Infura.
2. Create `web/.env.local` (it is git-ignored) with:
   ```
   NEXT_PUBLIC_ENABLE_SEPOLIA=1
   NEXT_PUBLIC_SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
   ```
   The WalletConnect id is optional (free at https://cloud.reown.com); MetaMask works without it. Never put a private key in this file: every `NEXT_PUBLIC_` value ends up in the page.
3. Rebuild and restart the app (`NEXT_PUBLIC_` values are read at build time, so a running server will not pick them up):
   ```bash
   npm --prefix web run build
   ```
   ```bash
   npm --prefix web run start
   ```
4. Switch MetaMask to **Sepolia**. The header badge must read **"Sepolia, real FHE"**. If it still says "Local FHEVM mock", the flag was not in the build: check the file name and rebuild.
5. Add one bill before any demo: the first real encryption downloads a public key of about 50 MB.

### Redeploying the contracts on Sepolia (only when the contracts change)

Needed whenever a contract function is added. For example, "Function setInsights not found on ABI" meant the deployed contracts were older than the code. In **one** PowerShell window, from the repo root:

```bash
$env:RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com"
```
```bash
$s = Read-Host "Deployer key" -AsSecureString; $env:DEPLOYER_PRIVATE_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
```
```bash
npm --prefix contracts run deploy
```
```bash
node contracts/scripts/verify-deploy.mjs --keep 31337
```
```bash
Remove-Item Env:DEPLOYER_PRIVATE_KEY; Remove-Variable s
```

The deploy prints the target chain, deployer and balance before it sends anything. Verification must print `DEPLOY VERIFIED chain=11155111`. Commit the updated `deployments.json` and `deployments.ts`. Old datasets stay on the old contracts, so recreate the demo dataset afterwards.

## 5. Encrypted ML (Concrete ML in Docker)

Concrete ML only runs on Linux, so it runs in Docker. Three containers start from `ml/docker-compose.yml`:

| Container | Port | Role |
|---|---|---|
| trainer | none | trains and compiles both models once, writes `web/public/ml/model-card.json`, then exits |
| server | 127.0.0.1:8000 | the FHE inference server; it only ever sees ciphertexts |
| helper | 127.0.0.1:8765 | the seller-side helper; it holds the private keys and decrypts only results |

1. **Keep Docker's data off a full C: drive (recommended).** Install Docker Desktop with its program and data on D:. Run this in an **Administrator** PowerShell, with the installer saved on D: (adjust the path):
   ```bash
   Start-Process "D:\Downloads\Docker Desktop Installer.exe" -Wait -ArgumentList "install", "--accept-license", "--installation-dir=D:\Docker", "--wsl-default-data-root=D:\DockerData"
   ```
   If Docker is already installed: Docker Desktop → Settings → Resources → Advanced → **Disk image location** → `D:\DockerData` → Apply & restart.
2. Start Docker Desktop and wait for "Engine running".
3. Build and start the stack from the repo root. The first build downloads about 1 GB (CPU-only PyTorch, Concrete ML) and the first start compiles the models for a few minutes:
   ```bash
   docker compose -f ml/docker-compose.yml up --build
   ```
   Done when the trainer prints `copied model card` and exits with code 0, and both servers print `Uvicorn running`. Leave this window open; closing it stops the servers.
4. Check both services:
   ```bash
   curl.exe http://localhost:8000/health
   ```
   ```bash
   curl.exe http://localhost:8765/health
   ```
   Expect `{"ok":true,"models":["anomaly","forecast"]}` and `{"ok":true,"server":true}`.
5. Use it: as the **seller**, open My Datasets → **View Analytics** → **Run encrypted ML**. Sign the decrypt, approve the `setInsights` transaction, and the forecast and anomaly charts fill in. Buyers then see them after one signature.

The helper only accepts requests from `http://localhost:3000` and `http://127.0.0.1:3000` by default, so serve the app on port 3000. For another origin (a deployed site), see `docs/DEPLOY.md`.

## 6. Checks before a demo

```bash
npm --prefix contracts test
```
```bash
npm --prefix web run check
```

`check` runs TypeScript, ESLint, Vitest and the guardrails scan. The full local rehearsal (fresh node, deploy, build, then a seller and a buyer driven through the real flow in headless Chrome) takes 8 to 14 minutes and ends with `DEMO REHEARSAL OK`:

```bash
node scripts/demo-rehearse.mjs
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Every transaction fails after restarting the node | MetaMask → Settings → Advanced → Clear activity tab data, redeploy, reload |
| Red banner "The contracts are not on this chain" | The node was restarted without a deploy: `npm --prefix contracts run deploy` |
| Badge says "Local FHEVM mock" while MetaMask is on Sepolia | `NEXT_PUBLIC_ENABLE_SEPOLIA=1` missing from `web/.env.local`, or the app was not rebuilt |
| "Function ... not found on ABI" | The deployed contracts are older than the code: redeploy (Part 4) |
| "ML helper not running" on the analytics page | Start the Docker stack (Part 5) and serve the app on port 3000 |
| Docker build fails with "no space left on device" | Move Docker's disk image to D: (Part 5, step 1), then `docker builder prune -af` |
| Deploy says "No unlocked account ... set DEPLOYER_PRIVATE_KEY" | The key was set in a different PowerShell window; set it again in the same one |

## The launch video (local only)

`videos/opaquely-launch/` holds the HyperFrames project for the 50-second launch video, with the final file at `videos/opaquely-launch/renders/video.mp4`. `videos/` is git-ignored, so it exists only on the machine that made it. To render it again there after editing a frame in `compositions/frames/`:

```bash
cd videos/opaquely-launch
```
```bash
npx hyperframes render --quality high --output renders/video.mp4
```
