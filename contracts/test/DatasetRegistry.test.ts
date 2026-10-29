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

  it("clamps an out-of-range category into Other so the totals always add up to the grand total", async function () {
    const [seller] = await ethers.getSigners();
    const { registry, registryAddress } = await deployAll(ethers);
    await (await registry.createDataset("clamp")).wait();
    await addBill(fhevm, registry, registryAddress, seller, 1n, { amountCents: 777n, category: 9, dateDays: 20_000 });
    const got = await decryptAggregates(fhevm, registry, registryAddress, 1n, seller);
    expect(got.totals).to.deep.equal([0n, 0n, 0n, 0n, 0n, 777n]);
    expect(got.grand).to.equal(777n);
  });

  it("measures the worst-case addRecord and keeps it far inside the HCU limits the node enforces", async function () {
    const [seller] = await ethers.getSigners();
    const { registry, registryAddress } = await deployAll(ethers);
    await (await registry.createDataset("hcu")).wait();
    // First bill is the worst case (uninitialised aggregates cost extra trivial encrypts). Every path is
    // select-based, so no input value changes the op count.
    const rc = await addBill(fhevm, registry, registryAddress, seller, 1n, { amountCents: 900_000n, category: 5, dateDays: 20_000 });
    const hcu = await fhevm.computeTransactionHCU(rc!.hash);
    expect(hcu.globalHCU, "total HCU per tx (limit 20,000,000)").to.be.lessThan(4_000_000);
    expect(hcu.maxHCUDepth, "HCU depth per tx (limit 5,000,000)").to.be.lessThan(1_000_000);
  });

  it("rejects bills from non-owners and on unknown datasets", async function () {
    const [seller, other] = await ethers.getSigners();
    const { registry, registryAddress } = await deployAll(ethers);
    await (await registry.createDataset("mine")).wait();
    await expect(addBill(fhevm, registry, registryAddress, other, 1n, BILLS[0])).to.be.revertedWithCustomError(registry, "NotDatasetOwner");
    await expect(addBill(fhevm, registry, registryAddress, seller, 99n, BILLS[0])).to.be.revertedWithCustomError(registry, "DatasetNotFound");
  });

  it("binds the input proof to the sender: a proof made for the seller cannot be replayed by another wallet", async function () {
    const [seller, other] = await ethers.getSigners();
    const { registry, registryAddress } = await deployAll(ethers);
    await (await registry.connect(seller).createDataset("a")).wait();
    await (await registry.connect(other).createDataset("b")).wait(); // other owns dataset 2
    const enc = await fhevm.client.encryptValues({
      values: [
        { type: "euint64", value: 5n },
        { type: "euint8", value: 1 },
        { type: "euint32", value: 1 },
      ],
      contractAddress: registryAddress as `0x${string}`,
      userAddress: seller.address as `0x${string}`,
    });
    await expect(
      registry.connect(other).addRecord(2n, enc.encryptedValues[0], enc.encryptedValues[1], enc.encryptedValues[2], enc.inputProof),
    ).to.revert(ethers);
  });

  it("only the Marketplace can seal or grant, and it can be wired once, by the deployer", async function () {
    const [deployer, stranger] = await ethers.getSigners();
    const { registry, marketAddress } = await deployAll(ethers);
    await expect(registry.connect(stranger).sealForListing(1n, stranger.address)).to.be.revertedWithCustomError(registry, "OnlyMarketplace");
    await expect(registry.connect(stranger).grantAccess(1n, stranger.address)).to.be.revertedWithCustomError(registry, "OnlyMarketplace");
    await expect(registry.connect(stranger).setMarketplace(stranger.address)).to.be.revertedWithCustomError(registry, "NotDeployer");
    await expect(registry.connect(deployer).setMarketplace(marketAddress)).to.be.revertedWithCustomError(registry, "MarketplaceAlreadySet");
  });

  it("the seller can decrypt every per-bill handle; a stranger cannot", async function () {
    const [seller, stranger] = await ethers.getSigners();
    const { registry, registryAddress } = await deployAll(ethers);
    await (await registry.createDataset("bills")).wait();
    await addBill(fhevm, registry, registryAddress, seller, 1n, BILLS[0]);
    const [row] = await registry.getBillHandles(1n);
    const args = { contractAddress: registryAddress, userAddress: seller.address };
    expect(await fhevm.helpers.decryptUint64({ euint64: row.amountCents, ...args })).to.equal(BILLS[0].amountCents);
    expect(await fhevm.helpers.decryptUint8({ euint8: row.category, ...args })).to.equal(BILLS[0].category);
    expect(await fhevm.helpers.decryptUint32({ euint32: row.dateDays, ...args })).to.equal(BILLS[0].dateDays);
    await expectDenied(
      fhevm.helpers.decryptUint64({ euint64: row.amountCents, contractAddress: registryAddress, userAddress: stranger.address }),
    );
    expect(THRESHOLD_CENTS).to.equal(500_000n);
  });
});
