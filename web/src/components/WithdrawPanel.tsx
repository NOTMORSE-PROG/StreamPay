import { useState } from "react";
import type { Stream } from "../lib/contract";
import { withdraw, ChainError, SubmitError } from "../lib/contract";
import type { DemoWallet } from "../lib/demoWallet";
import type { LifecycleState } from "../lib/streams";
import {
  addReceipt,
  getReceipts,
  resolveWithdrawAmount,
  type Receipt,
} from "../lib/withdraw";
import { stroopsToXlmCompact } from "../lib/format";
import { explorerTxUrl } from "../lib/config";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";

// The money shot (build plan 0:40): one tap moves earned wages to the worker in
// about 5 seconds, then a receipt with a public explorer link. The withdraw
// amount is the I-7-clamped chain value (available), never the animated display.
// The demo wallet signs (worker is the tx source, satisfying require_auth). Every
// withdrawal is appended to a browser-local, explorer-linked receipt trail (the
// "not a black box" story).

interface WithdrawPanelProps {
  stream: Stream;
  /** On-chain available to withdraw in stroops (chain read minus withdrawn). */
  available: bigint;
  state: LifecycleState;
  /** The loaded demo wallet, or null while it is still loading. */
  wallet: DemoWallet | null;
  /** Re-read the chain after a withdrawal so the balance reconciles to truth. */
  onWithdrawn: () => void;
}

type Phase = "idle" | "submitting";

export function WithdrawPanel({
  stream,
  available,
  state,
  wallet,
  onWithdrawn,
}: WithdrawPanelProps) {
  const [amountInput, setAmountInput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [confirmAmount, setConfirmAmount] = useState<bigint | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>(() =>
    getReceipts(stream.id),
  );

  const isOwner = wallet !== null && wallet.publicKey === stream.worker;
  const cancelled = state === "cancelled";
  const canWithdraw =
    isOwner && !cancelled && available > 0n && phase === "idle";

  // First tap: resolve and validate the amount, then open the confirm modal. The
  // signature only happens after the worker confirms in the modal.
  const requestWithdraw = (): void => {
    const resolved = resolveWithdrawAmount(amountInput, available);
    if (resolved.amount === null) {
      setError(resolved.error);
      return;
    }
    setError(null);
    setConfirmAmount(resolved.amount);
  };

  const submit = async (amount: bigint): Promise<void> => {
    if (wallet === null) {
      return;
    }
    setPhase("submitting");
    try {
      const hash = await withdraw({
        worker: stream.worker,
        streamId: stream.id,
        amount,
        signXdr: (xdr) => wallet.signTransactionXdr(xdr),
      });
      setReceipts(
        addReceipt(stream.id, {
          amountStroops: amount.toString(),
          hash,
          atMs: Date.now(),
        }),
      );
      setAmountInput("");
      setConfirmAmount(null);
      onWithdrawn(); // reconcile the balance to the new on-chain withdrawn figure
    } catch (caught) {
      // A race (someone withdrew elsewhere) surfaces as a simulation/contract
      // rejection: show a plain message and re-read the chain so the available
      // figure corrects itself, rather than leaving a stale number.
      if (caught instanceof ChainError || caught instanceof SubmitError) {
        setError(
          "That cash-out did not go through, the amount may have changed. The balance has been refreshed, try again.",
        );
      } else {
        setError("Something went wrong. The balance has been refreshed.");
      }
      setConfirmAmount(null);
      onWithdrawn();
    } finally {
      setPhase("idle");
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="text-sm text-slate-500">Ready to cash out</span>
        <span className="min-w-0 break-words text-lg font-semibold text-slate-900 tabular-nums">
          {stroopsToXlmCompact(available)} XLM
        </span>
      </div>

      {isOwner && !cancelled ? (
        <>
          <input
            inputMode="decimal"
            value={amountInput}
            onChange={(event) => {
              setAmountInput(event.target.value);
              setError(null);
            }}
            disabled={phase === "submitting"}
            placeholder={`All (${stroopsToXlmCompact(available)} XLM)`}
            aria-label="Amount to cash out in XLM"
            className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 tabular-nums focus:border-teal-500 focus:outline-none disabled:bg-slate-50"
          />
          <button
            type="button"
            onClick={requestWithdraw}
            disabled={!canWithdraw}
            className="mt-3 w-full rounded-xl bg-teal-600 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
          >
            {amountInput.trim() === "" ? "Cash out all" : "Cash out"}
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled
          className="mt-4 w-full cursor-not-allowed rounded-xl bg-slate-200 py-3 text-center text-sm font-semibold text-slate-500"
        >
          {cancelled ? "Paycheck stopped" : "Cash out"}
        </button>
      )}

      {error !== null && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {error}
        </p>
      )}

      {!isOwner && !cancelled && (
        <p className="mt-3 text-xs text-slate-500">
          This paycheck pays a different account. Open this link in the browser
          that holds that account to cash out. Anyone can watch the balance
          here.
        </p>
      )}

      {receipts.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Cash-outs
          </h3>
          <ul className="mt-2 space-y-2">
            {receipts.map((receipt) => (
              <li
                key={receipt.hash}
                className="flex items-center justify-between text-sm"
              >
                <span className="tabular-nums text-slate-700">
                  {stroopsToXlmCompact(BigInt(receipt.amountStroops))} XLM
                </span>
                <a
                  href={explorerTxUrl(receipt.hash)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-teal-700 hover:text-teal-800"
                >
                  Receipt
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {confirmAmount !== null && (
        <Dialog
          title="Cash out"
          onClose={
            phase === "submitting"
              ? () => undefined
              : () => setConfirmAmount(null)
          }
          labelledBy="withdraw-confirm-title"
        >
          <p className="text-sm text-slate-600">
            This moves the money to your account. The rest of your balance keeps
            growing.
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex items-baseline justify-between">
              <dt className="text-slate-500">Cashing out now</dt>
              <dd className="text-lg font-semibold tabular-nums text-slate-900">
                {stroopsToXlmCompact(confirmAmount)} XLM
              </dd>
            </div>
            <div className="flex items-baseline justify-between">
              <dt className="text-slate-500">Still available after</dt>
              <dd className="tabular-nums text-slate-700">
                {stroopsToXlmCompact(available - confirmAmount)} XLM
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-slate-400">
            Arrives in about 5 seconds for a tiny fee. You get a public receipt
            you can open and verify yourself.
          </p>
          <div className="mt-5 flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setConfirmAmount(null)}
              disabled={phase === "submitting"}
              className="flex-1"
            >
              Back
            </Button>
            <Button
              onClick={() => void submit(confirmAmount)}
              disabled={phase === "submitting"}
              className="flex-1"
            >
              {phase === "submitting" ? "Sending..." : "Confirm cash-out"}
            </Button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
