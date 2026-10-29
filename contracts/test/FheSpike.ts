import { expect } from "chai";
import { network } from "hardhat";

const { ethers, fhevm } = await network.connect();

describe("FheSpike", function () {
  it("adds two encrypted amounts and the sender can decrypt the total", async function () {
    const [alice] = await ethers.getSigners();
    const spike = await ethers.deployContract("FheSpike");
    const contractAddress = await spike.getAddress();

    for (const value of [100, 250]) {
      const enc = await fhevm.helpers.encryptUint64({ value, contractAddress, userAddress: alice.address });
      await (await spike.submit(enc.externalEuint64, enc.inputProof)).wait();
    }
    const clear = await fhevm.helpers.decryptUint64({
      euint64: await spike.total(),
      contractAddress,
      userAddress: alice.address,
    });
    expect(clear).to.eq(350n);
  });
});
