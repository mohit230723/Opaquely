import { expect } from "chai";
import { network } from "hardhat";

export const THRESHOLD_CENTS = 500_000n; // 5,000.00 in the app currency: a bill above this is an anomaly
export const PRICE = 10n ** 16n; // 0.01 ETH

type Conn = Awaited<ReturnType<typeof network.connect>>;
type Fhevm = Conn["fhevm"];
type Ethers = Conn["ethers"];
type Signer = Awaited<ReturnType<Ethers["getSigners"]>>[number];

export interface Bill {
  amountCents: bigint;
  category: number;
  dateDays: number;
}

/** Deploy in the same order as the deploy script: Registry, Marketplace, then link them. */
export async function deployAll(ethers: Ethers, threshold: bigint = THRESHOLD_CENTS) {
  const registry = await ethers.deployContract("DatasetRegistry", [threshold]);
  const market = await ethers.deployContract("Marketplace", [await registry.getAddress()]);
  await (await registry.setMarketplace(await market.getAddress())).wait();
  return { registry, market, registryAddress: await registry.getAddress(), marketAddress: await market.getAddress() };
}

/** One createEncryptedInput batch: amount, category and date share ONE input proof. */
export async function addBill(fhevm: Fhevm, registry: any, registryAddress: string, seller: Signer, datasetId: bigint, bill: Bill) {
  const enc = await fhevm.client.encryptValues({
    values: [
      { type: "euint64", value: bill.amountCents },
      { type: "euint8", value: bill.category },
      { type: "euint32", value: bill.dateDays },
    ],
    contractAddress: registryAddress as `0x${string}`,
    userAddress: seller.address as `0x${string}`,
  });
  const tx = await registry
    .connect(seller)
    .addRecord(datasetId, enc.encryptedValues[0], enc.encryptedValues[1], enc.encryptedValues[2], enc.inputProof);
  return tx.wait();
}

export interface Decoded {
  totals: bigint[];
  grand: bigint;
  count: number;
  anomalies: number;
}

/** Decrypt the 9 aggregate handles as `user`. Throws if `user` has no ACL grant. */
export async function decryptAggregates(fhevm: Fhevm, registry: any, registryAddress: string, datasetId: bigint, user: Signer): Promise<Decoded> {
  const [totalHandles, grandH, countH, anomH] = await registry.getAggregates(datasetId);
  const args = { contractAddress: registryAddress, userAddress: user.address };
  const totals: bigint[] = [];
  for (const h of totalHandles as string[]) totals.push(await fhevm.helpers.decryptUint64({ euint64: h, ...args }));
  return {
    totals,
    grand: await fhevm.helpers.decryptUint64({ euint64: grandH, ...args }),
    count: Number(await fhevm.helpers.decryptUint32({ euint32: countH, ...args })),
    anomalies: Number(await fhevm.helpers.decryptUint32({ euint32: anomH, ...args })),
  };
}

/** The plugin's decrypt helper throws FhevmErrorBase: "User 0x... is not authorized to decrypt handle 0x...". */
export async function expectDenied(p: Promise<unknown>) {
  let threw: unknown;
  try {
    await p;
  } catch (e) {
    threw = e;
  }
  expect(threw, "decrypt should have been denied").to.not.equal(undefined);
  expect(String((threw as Error).message)).to.match(/not authorized to decrypt/);
}

/** Plain-JS oracle for the expected aggregates. */
export function expected(bills: Bill[], threshold: bigint = THRESHOLD_CENTS): Decoded {
  const totals = [0n, 0n, 0n, 0n, 0n, 0n];
  let grand = 0n;
  let anomalies = 0;
  for (const b of bills) {
    totals[Math.min(b.category, 5)] += b.amountCents;
    grand += b.amountCents;
    if (b.amountCents > threshold) anomalies += 1;
  }
  return { totals, grand, count: bills.length, anomalies };
}
