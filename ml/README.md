# Opaquely ML (Milestone 2): Concrete ML, encrypted inference

Two models run under fully homomorphic encryption:

- **anomaly**: a LogisticRegression that scores how unusual a bill looks (amount, category, weekday, day of month).
- **forecast**: a LinearRegression that predicts next month's spend from the last three monthly totals.

Three containers (`docker compose up --build` in this folder, with Docker Desktop running):

| Service | Port | Role |
|---|---|---|
| trainer | - | Trains on synthetic bills, compiles both models to FHE circuits, writes `web/public/ml/model-card.json`. Runs once. |
| server | 127.0.0.1:8000 | The FHE inference server. It only ever sees ciphertexts and public evaluation keys. |
| helper | 127.0.0.1:8765 | The seller-side helper. It holds the private keys, encrypts bill features and decrypts only the results. |

## The flow

1. On the dataset dashboard (My Datasets, then View Analytics), the seller clicks **Run encrypted ML**.
2. The seller's wallet decrypts the seller's own bills in the browser. Only the seller can do this.
3. The browser posts them to the helper on localhost, so they never leave the seller's machine.
4. The helper encrypts each bill's features and sends only ciphertexts to the FHE server. The server runs both models blind.
5. The helper decrypts the results and aggregates them: six monthly totals, a forecast, an anomaly count and a score histogram.
6. The browser re-encrypts the aggregates with FHEVM and calls `DatasetRegistry.setInsights`. Buyers of the dataset are granted them on-chain.
7. Buyers decrypt the totals and the ML insights on the same dashboard with one signature.

The first build downloads Concrete ML (a few GB) and the first training compiles the circuits (a few minutes).
