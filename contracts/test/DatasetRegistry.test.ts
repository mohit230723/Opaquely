import { expect } from "chai";
import { network } from "hardhat";
import { addBill, decryptAggregates, deployAll, expectDenied, expected, THRESHOLD_CENTS, type Bill } from "./helpers.js";

const { ethers, fhevm } = await network.connect();

// Category ids: 0 Utilities, 1 Groceries/Food, 2 Medical, 3 Transport/Fuel, 4 Shopping, 5 Other
const BILLS: Bill[] = [
  { amountCents: 120_000n, category: 0, dateDays: 20_000 },
  { amountCents: 45_050n, category: 1, dateDays: 20_001 },
  { amountCents: 900_000n, category: 2, dateDays: 20_002 }, // above the 500,000 threshold: anomaly
];

describe("DatasetRegistry: encrypted aggregates (COMP-01..04)", function () {
  it("updates per-category totals, grand total, record count and anomaly count after bill 1, 2 and 3", async function () {
    const [seller] = await ethers.getSigners();
    const { registry, registryAddress } = await deployAll(ethers);
    await (await registry.connect(seller).createDataset("Q3 household")).wait();

    for (let n = 1; n <= BILLS.length; n++) {
      await addBill(fhevm, registry, registryAddress, seller, 1n, BILLS[n - 1]);
      const got = await decryptAggregates(fhevm, registry, registryAddress, 1n, seller);
      expect(got).to.deep.equal(expected(BILLS.slice(0, n)), `after bill ${n}`);
    }
    // Plaintext count agrees with the encrypted one.
    expect((await registry.getDataset(1n)).recordCount).to.equal(3n);
  });
});
