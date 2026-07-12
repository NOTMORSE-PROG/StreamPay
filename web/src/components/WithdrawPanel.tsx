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
import { stroopsToXlm } from "../lib/format";
import { explorerTxUrl } from "../lib/config";

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
  const [receipts, setReceipts] = useState<Receipt[]>(() =>
    getReceipts(stream.id),
  );

  const isOwner = wallet !== null && wallet.publicKey === stream.worker;
  const cancelled = state === "cancelled";
  const canWithdraw =
    isOwner && !cancelled && available > 0n && phase === "idle";

  const submit = async (): Promise<void> => {
    if (wallet === null) {
      return;
    }
    const resolved = resolveWithdrawAmount(amountInput, available);
    if (resolved.amount === null) {
      setError(resolved.error);
      return;
    }
    setError(null);
    setPhase("submitting");
    try {
      const hash = await withdraw({
        worker: stream.worker,
        streamId: stream.id,
        amount: resolved.amount,
        signXdr: (xdr) => wallet.signTransactionXdr(xdr),
      });
      setReceipts(
        addReceipt(stream.id, {
          amountStroops: resolved.amount.toString(),
          hash,
          atMs: Date.now(),
        }),
      );
      setAmountInput("");
      onWithdrawn(); // reconcile the balance to the new on-chain withdrawn figure
    } catch (caught) {
      // A race (someone withdrew elsewhere) surfaces as a simulation/contract
      // rejection: show a plain message and re-read the chain so the available
      // figure corrects itself, rather than leaving a stale number.
      if (caught instanceof ChainError || caught instanceof SubmitError) {
        setError(
          "That withdrawal did not go through, the amount may have changed. The balance has been refreshed, try again.",
        );
      } else {
        setError("Something went wrong. The balance has been refreshed.");
      }
      onWithdrawn();
    } finally {
      setPhase("idle");
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-slate-500">Available to withdraw</span>
        <span className="text-lg font-semibold text-slate-900 tabular-nums">
          {stroopsToXlm(available, { group: true })} XLM
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
            placeholder={`All (${stroopsToXlm(available)} XLM)`}
            aria-label="Amount to withdraw in XLM"
            className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 tabular-nums focus:border-teal-500 focus:outline-none disabled:bg-slate-50"
          />
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canWithdraw}
            className="mt-3 w-full rounded-xl bg-teal-600 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
          >
            {phase === "submitting"
              ? "Sending to your wallet..."
              : amountInput.trim() === ""
                ? "Withdraw all"
                : "Withdraw"}
          </button>
          {phase === "submitting" && (
            <p className="mt-2 text-center text-xs text-slate-500">
              Settling on Stellar, about 5 seconds.
            </p>
          )}
        </>
      ) : (
        <button
          type="button"
          disabled
          className="mt-4 w-full cursor-not-allowed rounded-xl bg-slate-200 py-3 text-center text-sm font-semibold text-slate-500"
        >
          {cancelled ? "Stream cancelled" : "Withdraw"}
        </button>
      )}

      {error !== null && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {error}
        </p>
      )}

      {!isOwner && !cancelled && (
        <p className="mt-3 text-xs text-slate-500">
          This stream pays a different wallet. Open this link in the browser
          that holds that wallet to withdraw. Anyone can watch the balance here.
        </p>
      )}

      {receipts.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Withdrawals
          </h3>
          <ul className="mt-2 space-y-2">
            {receipts.map((receipt) => (
              <li
                key={receipt.hash}
                className="flex items-center justify-between text-sm"
              >
                <span className="tabular-nums text-slate-700">
                  {stroopsToXlm(BigInt(receipt.amountStroops), { group: true })}{" "}
                  XLM
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
    </section>
  );
}
