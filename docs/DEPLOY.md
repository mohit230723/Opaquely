# Deploying Opaquely

This puts Opaquely on a public URL with real FHE. Set up the project first (`docs/SETUP.md`, Parts 1, 2 and 4).

## What runs where

| Piece | Where it runs | Status |
|---|---|---|
| Smart contracts | Sepolia test network | **Already deployed.** Addresses are committed in `web/src/contracts/deployments.json` |
| Web app (Next.js) | Vercel (free Hobby plan) | Steps below |
| FHE encryption and decryption | The visitor's browser, plus Zama's Sepolia relayer | Nothing to deploy |
| Concrete ML helper (holds the private keys) | **The seller's own computer**, in Docker | Must stay local by design |
| Concrete ML FHE server | The seller's computer (default), or a cloud VM (optional) | Steps below |

The helper decrypts the seller's bills and holds the Concrete ML private keys, so it must never run on a shared server. That is the privacy promise. Only the FHE server, which sees ciphertexts and public evaluation keys, may live in the cloud.

---

## Part A: the web app on Vercel

### A1. Pick the branch that deploys

Vercel deploys the repository's production branch, `main` by default. The current work is on `gsd/milestone-1`. Either:

- merge `gsd/milestone-1` into `main` (through a pull request), or
- in Vercel, set Settings → Git → **Production Branch** to `gsd/milestone-1`.

### A2. Create the Vercel project

1. Sign in at https://vercel.com with the GitHub account that owns `mohit230723/Opaquely`.
2. **Add New → Project**, and import `Opaquely`.
3. Configure the project:

   | Setting | Value |
   |---|---|
   | Framework Preset | Next.js |
   | Root Directory | `web` |
   | Install Command | `npm ci` |
   | Build Command | `npm run build` |
   | Node.js Version (Settings → General) | 22.x |

4. Add the environment variables (Settings → Environment Variables, for Production and Preview):

   | Name | Value | Why |
   |---|---|---|
   | `NEXT_PUBLIC_ENABLE_SEPOLIA` | `1` | Turns on Sepolia and real FHE. Without it the site only knows the local chain |
   | `NEXT_PUBLIC_SEPOLIA_RPC_URL` | `https://ethereum-sepolia-rpc.publicnode.com` | Keyless public RPC for chain reads |
   | `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | your project id from https://cloud.reown.com | Wallet modal; free |

   Never add `DEPLOYER_PRIVATE_KEY` or any other secret: every `NEXT_PUBLIC_` value is visible in the page.

5. Click **Deploy**. The build takes a few minutes. You get a URL such as `https://opaquely-xyz.vercel.app`.

If the build fails while bundling the Zama SDK, change the Build Command to `npx next build --webpack` and redeploy. The repo's notes name that as the fallback for Next 16's default bundler.

### A3. Finish the wallet setup

In https://cloud.reown.com, open your project and add the Vercel domain (for example `opaquely-xyz.vercel.app`) to its allowed domains. The WalletConnect modal refuses other origins.

### A4. Check the live site

1. Open the URL in Chrome with MetaMask on **Sepolia**. The header badge must read **"Sepolia, real FHE"**.
2. Seller wallet: Upload → a sample bill → Encrypt → list for 0.05 ETH. The first encryption downloads a public key of about 50 MB, so wait for it.
3. Buyer wallet (a second Chrome profile): Marketplace → Buy → "Access granted" → View Analytics → Decrypt.
4. Optional privacy check: in DevTools → Network, confirm that no request carries the bill image, the OCR text or the vendor name. Only ciphertexts and proofs go to the relayer and the chain.

Every push to the production branch redeploys automatically. Pushes to other branches get preview URLs.

---

## Part B: encrypted ML with the deployed site

The analytics page calls the helper at `http://127.0.0.1:8765` in the **visitor's** browser. So the seller runs the ML stack on their own computer, and the deployed page talks to it locally.

### B1. Let the deployed site reach the local helper

The helper only accepts requests from origins listed in `WEB_ORIGINS`. Start the stack with your Vercel URL added. In PowerShell, from the repo root:

```bash
$env:WEB_ORIGINS = "https://opaquely-xyz.vercel.app,http://localhost:3000,http://127.0.0.1:3000"
```
```bash
docker compose -f ml/docker-compose.yml up -d
```

Use your real Vercel URL, with no trailing slash. `-d` runs the stack in the background. If it was already running, the same command recreates the helper with the new setting.

Check it:
```bash
curl.exe http://localhost:8765/health
```

### B2. Run it from the live site

As the seller, open View Analytics → **Run encrypted ML**. Chrome may ask whether the site may connect to devices on your local network; allow it. The helper is on your own machine. Use Chrome for this step, since some browsers block public sites from calling localhost.

The status dot must say **"ML helper and FHE server running"**. The run then asks for one signature and one `setInsights` transaction (a little Sepolia ETH).

Only the seller needs the ML stack, and only while running the models. Buyers just open the dashboard; the insights are on chain.

### B3. Optional: move the FHE server to a cloud VM

This is optional and untested. The default (everything on the seller's laptop) is simpler and is what the demo uses. Do it only to show that the computation happens on a separate, untrusted machine.

**Requirements:** an x86_64 Linux VM (Ubuntu 22.04 or newer) with at least 4 GB RAM, 15 GB disk and Docker installed, and a domain or subdomain pointing at it (for HTTPS). Compiled models only run on the CPU architecture they were compiled for, so do not use an ARM VM.

**The server and the helper must use the same compiled models.** Train once on the laptop, then copy the result to the VM:

1. On the laptop (with the stack built once), export the trained models from the repo root:
   ```bash
   docker run --rm -v ml_artifacts:/a -v "${PWD}:/out" alpine tar czf /out/ml-artifacts.tgz -C /a .
   ```
2. Copy the repo and `ml-artifacts.tgz` to the VM. On the VM, from the repo root:
   ```bash
   docker volume create ml_artifacts
   ```
   ```bash
   docker run --rm -v ml_artifacts:/a -v "$PWD:/in" alpine tar xzf /in/ml-artifacts.tgz -C /a
   ```
   ```bash
   docker compose -f ml/docker-compose.yml up -d --build server
   ```
   The trainer runs first but skips training, because the models already exist (`--if-missing`).
3. Put HTTPS in front of the server, which listens only on the VM's 127.0.0.1:8000. With Caddy installed on the VM:
   ```bash
   sudo caddy reverse-proxy --from ml.example.com --to 127.0.0.1:8000
   ```
   Replace `ml.example.com` with your domain, and open ports 80 and 443 in the VM's firewall.
4. On the seller's laptop, run only the helper and point it at the VM:
   ```bash
   $env:FHE_SERVER_URL = "https://ml.example.com"
   ```
   ```bash
   docker compose -f ml/docker-compose.yml up -d --no-deps helper
   ```
   Keep `WEB_ORIGINS` set as in B1.

The server has no login. Anyone who finds the URL can send it work, though it only ever handles ciphertexts it cannot read. Stop the VM after the demo.

---

## Updating after a change

| Change | Do this |
|---|---|
| Web code | Push to the production branch; Vercel redeploys |
| A `NEXT_PUBLIC_` variable | Change it in Vercel, then **Redeploy** (values are built into the page) |
| A contract | Redeploy on Sepolia (`docs/SETUP.md`, Part 4), commit `deployments.json` and `deployments.ts`, push |
| ML code or models | `docker compose -f ml/docker-compose.yml up -d --build`; with a VM, retrain once and copy the artifacts again (B3) |

## Costs

Vercel Hobby, Sepolia test ETH and the local Docker stack are all free. Only the optional VM in B3 costs money.
