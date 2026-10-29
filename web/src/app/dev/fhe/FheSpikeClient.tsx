"use client";

import { useState } from "react";
import { isAddress, parseAbi, type Hex } from "viem";
import { useChainId, usePublicClient, useWalletClient } from "wagmi";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { encryptUint64 } from "@/lib/fhe";

const abi = parseAbi(["function submit(bytes32 amount, bytes inputProof)"]);
const MAX_UINT64 = BigInt("18446744073709551615");
const BUSY = new Set(["encrypting", "awaiting signature", "pending"]);

export function FheSpikeClient({ initialAddress }: { initialAddress: string }) {
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [address, setAddress] = useState(initialAddress);
  const [amount, setAmount] = useState("4242");
  const [status, setStatus] = useState("idle");
  const [handle, setHandle] = useState("");
  const [txHash, setTxHash] = useState("");
  const busy = BUSY.has(status);

  async function run() {
    if (busy) return;
    setHandle("");
    setTxHash("");
    const account = walletClient?.account;
    if (!publicClient || !walletClient || !account) {
      setStatus("failed: Connect a wallet first.");
      return;
    }
    if (!isAddress(address)) {
      setStatus("failed: Enter the spike contract address (0x followed by 40 hex characters).");
      return;
    }
    const digits = amount.trim();
    if (!/^\d{1,20}$/.test(digits) || BigInt(digits) > MAX_UINT64) {
      setStatus("failed: Enter a whole number from 0 to 18446744073709551615.");
      return;
    }
    try {
      setStatus("encrypting");
      const enc = await encryptUint64(chainId, { publicClient, walletClient }, address, BigInt(digits));
      setHandle(enc.handle);
      setStatus("awaiting signature");
      const hash: Hex = await walletClient.writeContract({
        address,
        abi,
        functionName: "submit",
        args: [enc.handle, enc.inputProof],
        chain: walletClient.chain,
        account,
      });
      setTxHash(hash);
      setStatus("pending");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setStatus(receipt.status === "reverted" ? "failed: Transaction reverted." : "confirmed");
    } catch (e) {
      setStatus("failed: " + (e instanceof Error ? e.message.slice(0, 200) : "unknown"));
    }
  }

  return (
    <PageShell
      title="FHE browser spike (dev only)"
      subtitle="Local FHEVM mock: the node receives this value in cleartext. Do not enter real bill data."
    >
      <div className="max-w-2xl space-y-4">
        <Field
          label="Spike contract address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
        <Field
          label="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="numeric"
          autoComplete="off"
        />
        <Button onClick={run} loading={busy}>
          Encrypt and submit
        </Button>
        <p data-testid="status">{status}</p>
        <p data-testid="handle" className="font-mono break-all">
          {handle}
        </p>
        <p data-testid="txhash" className="font-mono break-all">
          {txHash}
        </p>
      </div>
    </PageShell>
  );
}
