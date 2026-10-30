import { Card } from "@/components/ui/Card";
import { networkLabel } from "@/lib/network";

/** Who this wallet is: the full address in Geist Mono (wraps, full value in the title) and the network label. */
export function WalletCard({ address, chainId }: { address: string | undefined; chainId: number | undefined }) {
  return (
    <Card data-testid="wallet-card">
      <dl className="flex flex-col gap-4">
        <div className="min-w-0">
          <dt className="text-sm text-muted">Wallet</dt>
          <dd className="mt-1 break-all font-mono text-base" title={address}>
            {address ?? "Not connected"}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Network</dt>
          <dd className="mt-1 text-base">{networkLabel(chainId)}</dd>
        </div>
      </dl>
    </Card>
  );
}
