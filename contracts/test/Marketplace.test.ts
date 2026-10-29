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
});
