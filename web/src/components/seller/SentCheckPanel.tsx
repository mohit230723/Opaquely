import { Button } from "@/components/ui/Button";
import { plural } from "@/lib/format";

/** Result of looking the dataset up again after a failure that happened once the transaction was sent. */
export type SentCheck = { hash: string; result: "checking" | "added" | "not_added" | "unknown"; billCount?: number };

/** Shown under a failed add-bill transaction that was already sent: check the dataset before sending again. */
export function SentCheckPanel({
  check,
  datasetId,
  onCheck,
  onSendAgain,
  onAddAnother,
}: {
  check: SentCheck | null;
  datasetId: string;
  onCheck: () => void;
  onSendAgain: () => void;
  onAddAnother: () => void;
}) {
  const checking = check?.result === "checking";
  return (
    <div className="mt-4" data-testid="sent-check">
      {check === null || checking || check.result === "unknown" ? (
        <>
          <p className="text-sm text-muted">
            {check?.result === "unknown"
              ? "Could not read the dataset just now. Check again before you send this bill a second time."
              : "Your transaction was sent, so the bill may already be on the dataset. Check before you add it again."}
          </p>
          <div className="mt-3">
            <Button variant="secondary" onClick={onCheck} loading={checking}>
              Check status
            </Button>
          </div>
        </>
      ) : check.result === "added" ? (
        <>
          <p className="text-sm">
            The dataset now holds {plural(check.billCount ?? 0, "bill")}, so this bill was added. Do not add it again.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button onClick={onAddAnother}>Add another bill</Button>
            <Button variant="secondary" href={`/sell/datasets/${datasetId}`}>
              Back to dataset
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted">
            The dataset does not show this bill. If the first transaction is still pending it could land later, so send it
            again only if you are sure it did not go through.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button variant="secondary" onClick={onCheck}>
              Check again
            </Button>
            <Button onClick={onSendAgain}>Send again</Button>
          </div>
        </>
      )}
    </div>
  );
}
