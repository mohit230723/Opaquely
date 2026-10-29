import { expect } from "chai";
import { network } from "hardhat";
import { addBill, decryptAggregates, deployAll, expectDenied, expected, PRICE, type Bill } from "./helpers.js";

const { ethers, fhevm } = await network.connect();

const BILLS: Bill[] = [
  { amountCents: 120_000n, category: 0, dateDays: 20_000 },
  { amountCents: 45_050n, category: 1, dateDays: 20_001 },
  { amountCents: 900_000n, category: 2, dateDays: 20_002 },
];

/** Seller creates dataset 1 (or the next id), adds `bills`, returns the dataset id. */
async function seededDataset(ctx: Awaited<ReturnType<typeof deployAll>>, seller: any, name: string, bills: Bill[]) {
  await (await ctx.registry.connect(seller).createDataset(name)).wait();
  const id = await ctx.registry.datasetCount();
  for (const b of bills) await addBill(fhevm, ctx.registry, ctx.registryAddress, seller, id, b);
  return id;
}

async function listed(ctx: Awaited<ReturnType<typeof deployAll>>, seller: any, datasetId: bigint, price = PRICE) {
  await (await ctx.market.connect(seller).listDataset(datasetId, "Household Q3", "Utilities and food", price, 0b000111)).wait();
  return ctx.market.listingCount();
}

describe("Marketplace: seal-then-sell rules (MKT-02)", function () {
  it("refuses to list a dataset with fewer than 3 bills, then lists once it has 3", async function () {
    const [seller] = await ethers.getSigners();
    const ctx = await deployAll(ethers);
    const id = await seededDataset(ctx, seller, "small", BILLS.slice(0, 2));
    await expect(ctx.market.connect(seller).listDataset(id, "t", "d", PRICE, 1)).to.be.revertedWithCustomError(ctx.registry, "TooFewBills");
    await addBill(fhevm, ctx.registry, ctx.registryAddress, seller, id, BILLS[2]);
    await expect(ctx.market.connect(seller).listDataset(id, "t", "d", PRICE, 1)).to.emit(ctx.market, "Listed");
  });

  it("seals on listing: adding a bill afterwards reverts, and listing twice reverts", async function () {
    const [seller] = await ethers.getSigners();
    const ctx = await deployAll(ethers);
    const id = await seededDataset(ctx, seller, "full", BILLS);
    await listed(ctx, seller, id);
    expect((await ctx.registry.getDataset(id)).isSealed).to.equal(true);
    await expect(addBill(fhevm, ctx.registry, ctx.registryAddress, seller, id, BILLS[0])).to.be.revertedWithCustomError(ctx.registry, "DatasetIsSealed");
    await expect(ctx.market.connect(seller).listDataset(id, "t", "d", PRICE, 1)).to.be.revertedWithCustomError(ctx.registry, "DatasetIsSealed");
  });

  it("only the owner can list, and the listing fields are validated", async function () {
    const [seller, other] = await ethers.getSigners();
    const ctx = await deployAll(ethers);
    const id = await seededDataset(ctx, seller, "full", BILLS);
    await expect(ctx.market.connect(other).listDataset(id, "t", "d", PRICE, 1)).to.be.revertedWithCustomError(ctx.registry, "NotDatasetOwner");
    await expect(ctx.market.connect(seller).listDataset(id, "t", "d", 0n, 1)).to.be.revertedWithCustomError(ctx.market, "ZeroPrice");
    await expect(ctx.market.connect(seller).listDataset(id, "", "d", PRICE, 1)).to.be.revertedWithCustomError(ctx.market, "InvalidTitle");
    await expect(ctx.market.connect(seller).listDataset(id, "t", "d", PRICE, 64)).to.be.revertedWithCustomError(ctx.market, "InvalidCategoryMask");
  });
});

describe("Marketplace: buying, ACL and payments (MKT-07, MKT-09)", function () {
  it("buyer cannot decrypt the aggregates before buying, can after, and never gets a per-bill handle", async function () {
    const [seller, buyer] = await ethers.getSigners();
    const ctx = await deployAll(ethers);
    const id = await seededDataset(ctx, seller, "full", BILLS);
    const listingId = await listed(ctx, seller, id);

    // Before: denied on every one of the 9 aggregate handles.
    await expectDenied(decryptAggregates(fhevm, ctx.registry, ctx.registryAddress, id, buyer));
    const [totalHandles, grandH, countH, anomH] = await ctx.registry.getAggregates(id);
    for (const h of [...totalHandles, grandH, countH, anomH]) expect(await ctx.registry.canAccess(h, buyer.address)).to.equal(false);

    await expect(ctx.market.connect(buyer).buyListing(listingId, PRICE, { value: PRICE }))
      .to.emit(ctx.market, "Purchased")
      .and.to.emit(ctx.registry, "AccessGranted");

    // After: the buyer decrypts exactly the aggregates.
    expect(await decryptAggregates(fhevm, ctx.registry, ctx.registryAddress, id, buyer)).to.deep.equal(expected(BILLS));
    for (const h of [...totalHandles, grandH, countH, anomH]) expect(await ctx.registry.canAccess(h, buyer.address)).to.equal(true);

    // Still denied on every per-bill handle (amount, category, date), by ACL probe and by real decrypt.
    const args = { contractAddress: ctx.registryAddress, userAddress: buyer.address };
    for (const row of await ctx.registry.getBillHandles(id)) {
      for (const h of [row.amountCents, row.category, row.dateDays]) expect(await ctx.registry.canAccess(h, buyer.address)).to.equal(false);
      await expectDenied(fhevm.helpers.decryptUint64({ euint64: row.amountCents, ...args }));
      await expectDenied(fhevm.helpers.decryptUint8({ euint8: row.category, ...args }));
      await expectDenied(fhevm.helpers.decryptUint32({ euint32: row.dateDays, ...args }));
    }
  });

  it("a third wallet that did not buy is denied, while the seller and the buyer are not", async function () {
    const [seller, buyer, third] = await ethers.getSigners();
    const ctx = await deployAll(ethers);
    const id = await seededDataset(ctx, seller, "full", BILLS);
    const listingId = await listed(ctx, seller, id);
    await (await ctx.market.connect(buyer).buyListing(listingId, PRICE, { value: PRICE })).wait();
    await expectDenied(decryptAggregates(fhevm, ctx.registry, ctx.registryAddress, id, third));
    expect(await ctx.market.hasAccess(listingId, third.address)).to.equal(false);
    expect(await ctx.market.hasAccess(listingId, buyer.address)).to.equal(true);
    expect(await ctx.registry.hasAccess(id, buyer.address)).to.equal(true);
    expect((await decryptAggregates(fhevm, ctx.registry, ctx.registryAddress, id, seller)).grand).to.equal(1_065_050n);
  });

  it("rejects buying twice, buying your own listing, a wrong amount, a stale price and a missing listing", async function () {
    const [seller, buyer] = await ethers.getSigners();
    const ctx = await deployAll(ethers);
    const id = await seededDataset(ctx, seller, "full", BILLS);
    const listingId = await listed(ctx, seller, id);
    const m = ctx.market.connect(buyer);

    await expect(ctx.market.connect(seller).buyListing(listingId, PRICE, { value: PRICE })).to.be.revertedWithCustomError(ctx.market, "OwnListing");
    await expect(m.buyListing(listingId, PRICE, { value: PRICE - 1n })).to.be.revertedWithCustomError(ctx.market, "WrongPayment");
    await expect(m.buyListing(listingId, PRICE, { value: PRICE + 1n })).to.be.revertedWithCustomError(ctx.market, "WrongPayment");
    await expect(m.buyListing(listingId, PRICE + 1n, { value: PRICE })).to.be.revertedWithCustomError(ctx.market, "PriceChanged");
    await expect(m.buyListing(99n, PRICE, { value: PRICE })).to.be.revertedWithCustomError(ctx.market, "ListingNotFound");
    await (await m.buyListing(listingId, PRICE, { value: PRICE })).wait();
    await expect(m.buyListing(listingId, PRICE, { value: PRICE })).to.be.revertedWithCustomError(ctx.market, "AlreadyPurchased");
  });

  it("holds proceeds in the contract until the seller withdraws, once", async function () {
    const [seller, buyer] = await ethers.getSigners();
    const ctx = await deployAll(ethers);
    const id = await seededDataset(ctx, seller, "full", BILLS);
    const listingId = await listed(ctx, seller, id);
    await (await ctx.market.connect(buyer).buyListing(listingId, PRICE, { value: PRICE })).wait();

    expect(await ethers.provider.getBalance(ctx.marketAddress)).to.equal(PRICE);
    expect(await ctx.market.pendingWithdrawals(seller.address)).to.equal(PRICE);
    expect(await ctx.market.sellerStats(seller.address)).to.deep.equal([1n, 1n, PRICE]);

    await expect(ctx.market.connect(buyer).withdraw()).to.be.revertedWithCustomError(ctx.market, "NothingToWithdraw");
    const w = ctx.market.connect(seller).withdraw();
    await expect(w).to.changeEtherBalances(ethers, [seller, ctx.marketAddress], [PRICE, -PRICE]);
    await expect(w).to.emit(ctx.market, "Withdrawn");
    expect(await ctx.market.pendingWithdrawals(seller.address)).to.equal(0n);
    await expect(ctx.market.connect(seller).withdraw()).to.be.revertedWithCustomError(ctx.market, "NothingToWithdraw"); // double withdraw
  });

  it("a reentrant seller contract cannot drain other sellers' proceeds", async function () {
    const [honest, buyer1, buyer2] = await ethers.getSigners();
    const ctx = await deployAll(ethers);
    const attacker = await ethers.deployContract("ReentrantSeller", [ctx.marketAddress]);
    const attackerAddr = await attacker.getAddress();

    // Honest seller: dataset + listing + one sale => PRICE pending.
    const hid = await seededDataset(ctx, honest, "honest", BILLS);
    const hl = await listed(ctx, honest, hid);
    await (await ctx.market.connect(buyer1).buyListing(hl, PRICE, { value: PRICE })).wait();

    // Attacker is a contract seller. It acts through exec(), and its input proofs are made for ITS address.
    const regIface = ctx.registry.interface;
    const mktIface = ctx.market.interface;
    await (await attacker.exec(ctx.registryAddress, regIface.encodeFunctionData("createDataset", ["evil"]))).wait();
    const aid = await ctx.registry.datasetCount();
    for (const b of BILLS) {
      const enc = await fhevm.client.encryptValues({
        values: [
          { type: "euint64", value: b.amountCents },
          { type: "euint8", value: b.category },
          { type: "euint32", value: b.dateDays },
        ],
        contractAddress: ctx.registryAddress as `0x${string}`,
        userAddress: attackerAddr as `0x${string}`,
      });
      await (
        await attacker.exec(ctx.registryAddress, regIface.encodeFunctionData("addRecord", [aid, enc.encryptedValues[0], enc.encryptedValues[1], enc.encryptedValues[2], enc.inputProof]))
      ).wait();
    }
    await (await attacker.exec(ctx.marketAddress, mktIface.encodeFunctionData("listDataset", [aid, "evil", "d", PRICE, 1]))).wait();
    const al = await ctx.market.listingCount();
    await (await ctx.market.connect(buyer2).buyListing(al, PRICE, { value: PRICE })).wait();
    expect(await ethers.provider.getBalance(ctx.marketAddress)).to.equal(2n * PRICE);

    // Attacker withdraws; its receive() tries to re-enter withdraw().
    await (await attacker.exec(ctx.marketAddress, mktIface.encodeFunctionData("withdraw"))).wait();
    expect(await attacker.reentryAttempts()).to.equal(1n);
    expect(await attacker.reentrySucceeded()).to.equal(false);
    expect(await ethers.provider.getBalance(attackerAddr)).to.equal(PRICE); // got its own PRICE, once
    expect(await ethers.provider.getBalance(ctx.marketAddress)).to.equal(PRICE); // the honest seller's PRICE is intact
    expect(await ctx.market.pendingWithdrawals(honest.address)).to.equal(PRICE);
    await expect(ctx.market.connect(honest).withdraw()).to.changeEtherBalances(ethers, [honest, ctx.marketAddress], [PRICE, -PRICE]);
  });
});
