# Opaquely

## What This Is

Opaquely is a privacy-preserving analytics marketplace built on Zama FHEVM. **Input users (sellers)** upload bills and receipts; OCR runs in the browser, the extracted fields are encrypted with FHEVM, computation runs on-chain over the ciphertexts, and the encrypted dataset is listed for sale. **Authenticated users (buyers)** connect a wallet and sign a purchase transaction paying test ETH into escrow, and the smart contract grants their wallet access to that dataset. Later, Concrete ML will run encrypted machine learning (spend categorization, anomaly/fraud detection, scoring/prediction), and buyers will decrypt only the resulting **insights**, never the raw bill values.

Built as a college minor project for a friend.

## Core Value

A bill goes from image → browser OCR → FHEVM ciphertext → on-chain encrypted computation → marketplace listing → buyer purchase (escrowed ETH) → buyer's wallet granted access on-chain, and no plaintext bill data leaves the seller's browser.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Milestone 1: Friday evaluation demo (due Fri 2026-10-30)**

- [ ] Seller and buyer each connect a wallet and choose a role (input user vs authenticated user)
- [ ] Seller uploads a bill image and OCR runs in the browser (plaintext never leaves the device)
- [ ] Seller reviews and corrects the extracted fields (amount, vendor, date, category)
- [ ] Extracted fields are encrypted client-side with the FHEVM SDK and submitted to the contract with input proofs
- [ ] The contract computes on the encrypted values (e.g. encrypted totals per category, encrypted "amount > threshold" anomaly flag)
- [ ] Seller creates a marketplace listing (title, description, price in ETH) for an encrypted dataset
- [ ] Buyer browses listings and views listing metadata (never the data)
- [ ] Buyer signs a purchase transaction, ETH goes into escrow, and the contract records the buyer as authorized and grants FHEVM ACL access to the dataset handles
- [ ] Seller withdraws escrowed earnings
- [ ] Seller and buyer dashboards show uploads, listings, purchases, and access status
- [ ] Landing page uses the React Bits `<GradientASCII />` background in the hero
- [ ] Runs end-to-end locally on Hardhat with the FHEVM mock; Sepolia deploy if time allows

**Milestone 2: Post-evaluation (ML + decryption)**

- [ ] Concrete ML service runs encrypted inference off-chain: spend categorization, anomaly/fraud detection, scoring/prediction
- [ ] ML insights are stored on-chain as FHEVM encrypted values, and buyer access is granted via the ACL
- [ ] Authorized buyer decrypts insights (user decryption via EIP-712 signature) and sees them in an analytics dashboard
- [ ] Buyers see only ML insights, never raw extracted bill fields
- [ ] Deployed on Sepolia with the real Zama relayer and KMS

### Out of Scope

- Buyer decryption in the Friday demo — the user explicitly stops the demo at purchase and access grant
- Concrete ML in the Friday demo — deferred to Milestone 2 because of the two-day deadline
- Server-side OCR — OCR stays in the browser so plaintext never reaches a server
- Buyers seeing raw bill fields — privacy model is insights-only
- Confidential payment token (ERC-7984) — plain test ETH is enough for a minor project
- Mainnet deployment and real money — college project, testnet only
- Email/password accounts — identity is the wallet

## Context

- **Zama FHEVM**: Solidity contracts use encrypted types (`euint32`, `euint64`, `ebool`) via `@fhevm/solidity`. Inputs are encrypted client-side and submitted with proofs. Access is controlled by the on-chain ACL (`FHE.allow`, `FHE.allowThis`). Decryption goes through the relayer and the threshold KMS. The Hardhat template ships a mock mode for fast local development.
- **Concrete ML vs FHEVM**: these are separate stacks with incompatible keys and ciphertexts. A Concrete ML model cannot run directly on FHEVM ciphertexts. The chosen hybrid: Concrete ML runs off-chain in a Python service, and its insights are written on-chain as FHEVM encrypted values with ACL-gated access. Exactly how the two connect (who re-encrypts, and what trust that implies) needs research and a decision in Milestone 2.
- **Encrypted compute limits**: FHEVM supports add, sub, mul by plaintext, comparisons, and select on encrypted ints. Division and floating point are limited, so values such as amounts in cents are stored as integers.
- **UI**: the user has a custom UI direction. The confirmed background is React Bits `GradientASCII` (JS-CSS variant, no npm dependencies, `'use client'`, canvas-based, Geist Mono font). Source saved at `.planning/reference/GradientASCII-JS-CSS.json`. Config: `colors={['#1e3fd8','#f6f8ff','#a5d8ff','#38bdf8']}`, `shape="horizon"`, `characters=" =+xX0S8#@"`, `cellSize={18}`, `density={0.8}`, in a 100% × 600px relative container. It appears only in the landing hero; dashboards use a plain dark theme matching that blue palette. The user may supply more custom components later.

## Constraints

- **Timeline**: Milestone 1 must demo on Friday 2026-10-30, roughly two days from project start, so scope is aggressively cut to the purchase flow
- **Tech stack**: Next.js + TypeScript + Tailwind frontend; wagmi/viem + RainbowKit for wallets; Zama FHEVM Hardhat template + `@fhevm/solidity` for contracts; Zama relayer SDK for client-side encryption; Tesseract.js for browser OCR; Python + Concrete ML (Milestone 2)
- **Network**: local Hardhat with the FHEVM mock first, Sepolia second; ETH is test-only
- **Privacy**: raw bill plaintext must never leave the seller's browser
- **Team**: college minor project; readability and demo clarity matter more than production hardening

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Hybrid FHE: Concrete ML off-chain + FHEVM on-chain storage/ACL | Uses each technology where it fits; their keys are incompatible | — Pending |
| Buyers see ML insights only | Strongest privacy model; raw bills are never exposed | — Pending |
| OCR in the browser (Tesseract.js) | Plaintext never reaches a server | — Pending |
| Access = pay per listing; the purchase tx grants the ACL | Matches "signed transaction makes the user valid" | — Pending |
| Payment in test ETH into escrow; seller withdraws | Simple, but still shows a proper marketplace pattern | — Pending |
| Friday demo stops at purchase + access grant | User's explicit scope for the first evaluation | — Pending |
| Local Hardhat FHEVM mock first, Sepolia if time | Avoids faucet and relayer risk before a hard deadline | — Pending |
| GradientASCII background in the landing hero only | Keeps dashboards readable | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-29 after initialization*
