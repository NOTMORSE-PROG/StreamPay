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
import { stroopsToXlm } from "../lib/format";
import { explorerTxUrl } from "../lib/config";

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
        setError("Signature declined. The stream is untouched.");
      } else if (
        caught instanceof ChainError ||
        caught instanceof SubmitError
      ) {
        setError(
          "The cancellation did not go through (the stream may have changed). Nothing moved; you can close this and try again.",
        );
        onCancelled(); // refresh in case the state changed under us
      } else {
        setError("Something went wrong. The stream is unchanged.");
      }
      setPhase("confirm");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Cancel stream"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        {phase === "done" && executed !== null ? (
          <>
            <h2 className="text-lg font-semibold text-slate-900">
              Stream cancelled
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              The pot was split automatically and is final.
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
              View the cancellation on the explorer
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
            <h2 className="text-lg font-semibold text-slate-900">
              Cancel this stream?
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Cancelling splits the deposit automatically and cannot be undone.
              As of now:
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
              These are the amounts at this moment; the contract recomputes the
              exact split when you sign.
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
                Keep streaming
              </button>
              <button
                type="button"
                onClick={() => void confirm()}
                disabled={phase === "submitting"}
                className="flex-1 rounded-xl bg-amber-600 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              >
                {phase === "submitting" ? "Cancelling..." : "Cancel stream"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SplitRow({ label, amount }: { label: string; amount: bigint }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold tabular-nums text-slate-900">
        {stroopsToXlm(amount, { group: true })} XLM
      </dd>
    </div>
  );
}
