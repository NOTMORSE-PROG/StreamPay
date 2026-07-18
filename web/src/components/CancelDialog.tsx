import { useState } from "react";
import {
  cancelStream,
  getStream,
  ChainError,
  SubmitError,
  type Stream,
} from "../lib/contract";
import { signWithFreighter, SignError } from "../lib/wallet";
import { fairSplit } from "../lib/streams";
import { stroopsToXlmCompact } from "../lib/format";
import { explorerTxUrl } from "../lib/config";
import { Dialog } from "./ui/Dialog";

// The demo twist (build plan 2:20): the employer cancels, the contract splits the
// pot automatically, and the UI shows both legs from on-chain truth. The dialog
// states the split BEFORE signing (the fair-split explanation is the pitch); after
// the cancel lands it shows the EXECUTED split read back from post-cancel state
// (worker kept = the frozen withdrawn, employer refunded = deposit minus it), so
// intervening withdrawals never make the figures wrong.

interface CancelDialogProps {
  stream: Stream;
  /** Current on-chain accrued, for the pre-cancel "as of now" estimate. */
  accrued: bigint;
  employer: string;
  /** Reload the employer list after the stream state changes. */
  onCancelled: () => void;
  onClose: () => void;
}

type Phase = "confirm" | "submitting" | "done";

interface Executed {
  workerAmount: bigint;
  employerRefund: bigint;
  hash: string;
}

export function CancelDialog({
  stream,
  accrued,
  employer,
  onCancelled,
  onClose,
}: CancelDialogProps) {
  const [phase, setPhase] = useState<Phase>("confirm");
  const [error, setError] = useState<string | null>(null);
  const [executed, setExecuted] = useState<Executed | null>(null);

  const estimate = fairSplit(stream.deposit, accrued);

  const confirm = async (): Promise<void> => {
    setError(null);
    setPhase("submitting");
    try {
      const hash = await cancelStream({
        employer,
        streamId: stream.id,
        signXdr: (xdr) => signWithFreighter(xdr, employer),
      });
      // Read the EXECUTED split from post-cancel state (withdrawn is frozen to
      // the amount earned at the cancel instant): on-chain truth, not a guess.
      const after = await getStream(stream.id);
      setExecuted({
        ...fairSplit(after.deposit, after.withdrawn),
        hash,
      });
      setPhase("done");
      onCancelled();
    } catch (caught) {
      if (caught instanceof SignError) {
        setError("Approval declined. Nothing changed.");
      } else if (
        caught instanceof ChainError ||
        caught instanceof SubmitError
      ) {
        setError(
          "That did not go through (the paycheck may have changed). Nothing moved; you can close this and try again.",
        );
        onCancelled(); // refresh in case the state changed under us
      } else {
        setError("Something went wrong. Nothing changed.");
      }
      setPhase("confirm");
    }
  };

  const done = phase === "done" && executed !== null;

  return (
    <Dialog
      title={done ? "Payments stopped" : "Stop paying this worker?"}
      onClose={phase === "submitting" ? () => undefined : onClose}
      labelledBy="cancel-dialog-title"
    >
      {done && executed !== null ? (
        <>
          <p className="text-sm text-slate-600">
            The money was split automatically and this is final.
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <SplitRow label="Worker kept" amount={executed.workerAmount} />
            <SplitRow
              label="Refunded to you"
              amount={executed.employerRefund}
            />
          </dl>
          <a
            href={explorerTxUrl(executed.hash)}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block text-sm font-medium text-teal-700 hover:text-teal-800"
          >
            View the public receipt
          </a>
          <button
            type="button"
            onClick={onClose}
            className="mt-5 w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Done
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            Stopping splits the amount you set aside automatically and cannot be
            undone. As of now:
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <SplitRow
              label="Worker keeps (earned)"
              amount={estimate.workerAmount}
            />
            <SplitRow
              label="Refunded to you"
              amount={estimate.employerRefund}
            />
          </dl>
          <p className="mt-2 text-xs text-slate-400">
            These are the amounts at this moment; the exact split is
            recalculated automatically when you approve.
          </p>
          {error !== null && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {error}
            </p>
          )}
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={phase === "submitting"}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              Keep paying
            </button>
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={phase === "submitting"}
              className="flex-1 rounded-xl bg-amber-600 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              {phase === "submitting" ? "Stopping..." : "Stop paying"}
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}

function SplitRow({ label, amount }: { label: string; amount: bigint }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold tabular-nums text-slate-900">
        {stroopsToXlmCompact(amount)} XLM
      </dd>
    </div>
  );
}
