import { useState } from "react";
import {
  accountExists,
  ChainError,
  createStream,
  getChainTime,
  getTokenBalance,
  SubmitError,
} from "../lib/contract";
import {
  resolveWalletStatus,
  SignError,
  signWithFreighter,
} from "../lib/wallet";
import {
  perSecondStroops,
  validateCreateStreamInputs,
} from "../lib/validation";
import { stroopsToXlm, truncateAddress, xlmToStroops } from "../lib/format";
import { explorerTxUrl, friendbotUrl } from "../lib/config";
import {
  getSavedWorkers,
  saveWorker,
  type SavedWorker,
} from "../lib/addressBook";
import { getBusinessName } from "../lib/employerProfile";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { InfoHint } from "./ui/InfoHint";
import { QrCode } from "./ui/QrCode";
import { ShareButton } from "./ui/ShareButton";

// The employer's core action (15 seconds in the demo): enter a worker address, a
// total amount, and a duration; watch the live per-second rate; sign in Freighter;
// see the on-chain receipt. Start is derived from chain time, never Date.now()
// (T-008 finding). Form contents survive every error so a decline or RPC hiccup is
// a retry, not a re-type.

type DurationUnit = "minutes" | "hours";

export interface CreateStreamInitial {
  worker?: string;
  amount?: string;
  durationValue?: string;
  durationUnit?: DurationUnit;
}

interface CreateStreamFormProps {
  employer: string;
  onCreated: (streamId: bigint) => void;
  /** Prefill the form (the "start next period" renew flow). */
  initial?: CreateStreamInitial;
}

const UNIT_SECONDS: Record<DurationUnit, number> = { minutes: 60, hours: 3600 };

type FieldName = "worker" | "amount" | "duration";
type Phase = "idle" | "working" | "success" | "error";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 tabular-nums focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500";
const labelClass = "block text-sm font-medium text-slate-700";
const errorClass = "mt-1 text-xs text-red-600";

export function CreateStreamForm({
  employer,
  onCreated,
  initial,
}: CreateStreamFormProps) {
  const [workerAddress, setWorkerAddress] = useState(initial?.worker ?? "");
  const [amountText, setAmountText] = useState(initial?.amount ?? "");
  const [durationValue, setDurationValue] = useState(
    initial?.durationValue ?? "10",
  );
  const [durationUnit, setDurationUnit] = useState<DurationUnit>(
    initial?.durationUnit ?? "minutes",
  );
  const [savedWorkers] = useState<SavedWorker[]>(() => getSavedWorkers());

  const [fieldError, setFieldError] = useState<{
    field: FieldName;
    message: string;
  } | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [needsFunding, setNeedsFunding] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [pending, setPending] = useState<{
    worker: string;
    deposit: bigint;
    durationSeconds: bigint;
  } | null>(null);
  const [balanceAfter, setBalanceAfter] = useState<bigint | null>(null);
  const [created, setCreated] = useState<{
    streamId: bigint;
    hash: string;
  } | null>(null);

  const durationSeconds =
    Math.round(Number(durationValue)) * UNIT_SECONDS[durationUnit];
  const ratePreview = computeRatePreview(amountText, durationSeconds);

  // First step: validate the inputs, then open the review modal. Nothing is
  // signed until the employer confirms there. Input validation stays synchronous
  // so a bad address or amount shows an inline error without a network call.
  async function handleReview(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setFieldError(null);
    setSubmitError(null);
    setNeedsFunding(false);

    const validation = validateCreateStreamInputs({
      workerAddress,
      amountText,
      durationSeconds,
      employerAddress: employer,
    });
    if (!validation.ok) {
      setFieldError({ field: validation.field, message: validation.message });
      return;
    }

    setPending({
      worker: workerAddress.trim(),
      deposit: validation.deposit,
      durationSeconds: validation.durationSeconds,
    });
    setBalanceAfter(null);
    setReviewing(true);
    // Best-effort: show the wallet balance after this deposit. If the read
    // fails the line is simply omitted; the confirm path still checks funds.
    try {
      const balance = await getTokenBalance(employer);
      setBalanceAfter(balance - validation.deposit);
    } catch {
      setBalanceAfter(null);
    }
  }

  // Second step (in the modal): the money path. Checks the wallet and funds,
  // signs in Freighter, submits, and shows the on-chain receipt.
  async function handleConfirm(): Promise<void> {
    if (pending === null) {
      return;
    }
    setSubmitError(null);
    setNeedsFunding(false);
    setPhase("working");
    try {
      setStatusMessage("Checking your connection...");
      const wallet = await resolveWalletStatus();
      if (wallet.kind === "wrong-network") {
        setPhase("error");
        setSubmitError(
          "Switch your wallet app (Freighter) to Testnet, then try again.",
        );
        return;
      }
      if (wallet.kind !== "connected" || wallet.address !== employer) {
        setPhase("error");
        setSubmitError("Reconnect your wallet app, then try again.");
        return;
      }

      if (!(await accountExists(pending.worker))) {
        setReviewing(false);
        setPhase("idle");
        setFieldError({
          field: "worker",
          message:
            "That account does not exist yet. Ask the worker to open the /worker page first; it sets them up.",
        });
        return;
      }

      const balance = await getTokenBalance(employer);
      if (balance < pending.deposit) {
        setPhase("error");
        setNeedsFunding(true);
        setSubmitError(
          `Your balance (${stroopsToXlm(balance)} XLM) is less than the amount you are setting aside.`,
        );
        return;
      }

      setStatusMessage("Waiting for your approval in your wallet app...");
      const start = await getChainTime();
      const result = await createStream({
        employer,
        worker: pending.worker,
        deposit: pending.deposit,
        start,
        duration: pending.durationSeconds,
        signXdr: (xdr) => signWithFreighter(xdr, employer),
      });

      setCreated(result);
      setPhase("success");
      setStatusMessage(null);
      setReviewing(false);
      onCreated(result.streamId);
    } catch (error) {
      setPhase("error");
      setStatusMessage(null);
      setSubmitError(describeError(error));
    }
  }

  function reset(): void {
    setCreated(null);
    setPhase("idle");
    setSubmitError(null);
    setFieldError(null);
    setNeedsFunding(false);
    setReviewing(false);
    setPending(null);
    setAmountText("");
    setWorkerAddress("");
  }

  if (phase === "success" && created !== null) {
    return (
      <CreatedScreen
        streamId={created.streamId}
        hash={created.hash}
        workerAddress={pending?.worker ?? ""}
        onReset={reset}
      />
    );
  }

  const working = phase === "working";

  return (
    <form
      onSubmit={(event) => void handleReview(event)}
      className="rounded-2xl border border-slate-200 bg-white p-6"
    >
      <h2 className="text-lg font-semibold text-slate-900">
        Start paying a worker
      </h2>
      <div className="mt-4 space-y-4">
        {savedWorkers.length > 0 && (
          <div>
            <label htmlFor="saved-worker" className={labelClass}>
              Saved worker
            </label>
            <select
              id="saved-worker"
              value=""
              onChange={(event) => {
                if (event.target.value !== "") {
                  setWorkerAddress(event.target.value);
                }
              }}
              className={inputClass}
            >
              <option value="">Pick a saved worker...</option>
              {savedWorkers.map((w) => (
                <option key={w.address} value={w.address}>
                  {w.name} ({truncateAddress(w.address)})
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="worker" className={labelClass}>
            Worker's account number
          </label>
          <input
            id="worker"
            value={workerAddress}
            onChange={(event) => setWorkerAddress(event.target.value)}
            placeholder="G..."
            spellCheck={false}
            className={`${inputClass} font-mono`}
          />
          {fieldError?.field === "worker" && (
            <p className={errorClass}>{fieldError.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="amount" className={labelClass}>
            Total amount (test-XLM)
          </label>
          <input
            id="amount"
            inputMode="decimal"
            value={amountText}
            onChange={(event) => setAmountText(event.target.value)}
            placeholder="100"
            className={inputClass}
          />
          {fieldError?.field === "amount" && (
            <p className={errorClass}>{fieldError.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="duration" className={labelClass}>
            Duration
          </label>
          <div className="flex gap-2">
            <input
              id="duration"
              inputMode="numeric"
              value={durationValue}
              onChange={(event) => setDurationValue(event.target.value)}
              className={`${inputClass} flex-1`}
            />
            <select
              aria-label="Duration unit"
              value={durationUnit}
              onChange={(event) =>
                setDurationUnit(event.target.value as DurationUnit)
              }
              className={inputClass.replace("w-full", "w-32")}
            >
              <option value="minutes">minutes</option>
              <option value="hours">hours</option>
            </select>
          </div>
          {fieldError?.field === "duration" && (
            <p className={errorClass}>{fieldError.message}</p>
          )}
        </div>

        <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
          <span className="flex items-center gap-1.5 text-slate-500">
            Pay rate
            <InfoHint label="How the rate works">
              We divide the total by the duration to get a per-second rate. Your
              worker earns that much every second until the full amount is paid.
              You set it aside once; the automatic payment rule does the rest.
            </InfoHint>
          </span>
          <div className="mt-0.5 font-medium tabular-nums text-slate-900">
            {ratePreview === null
              ? "Enter an amount and duration"
              : `${ratePreview.perSecond} XLM / second`}
          </div>
          {ratePreview !== null && (
            <div className="text-xs text-slate-500 tabular-nums">
              about {ratePreview.perDay} XLM / day
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400">
          On this test demo the stream is funded in test tokens (test-XLM). In
          the real product it would be USDC, a digital dollar, and the worker
          cashes out in their local currency through a licensed partner.
        </p>

        <button
          type="submit"
          className="inline-flex w-full items-center justify-center rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700"
        >
          Review and start paying
        </button>
      </div>

      {reviewing && pending !== null && (
        <Dialog
          title="Review before you start paying"
          onClose={working ? () => undefined : () => setReviewing(false)}
          labelledBy="create-review-title"
        >
          <p className="text-sm text-slate-600">
            You approve once in your wallet app. After that, wages flow to your
            worker automatically, every second, with no further action from you.
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <ReviewRow
              label="Worker"
              value={
                <span className="font-mono" title={pending.worker}>
                  {truncateAddress(pending.worker, 6)}
                </span>
              }
            />
            <ReviewRow
              label="Total set aside"
              value={`${stroopsToXlm(pending.deposit, { group: true })} XLM`}
            />
            <ReviewRow
              label="Duration"
              value={
                ratePreview === null
                  ? `${durationSeconds.toString()} s`
                  : `${durationValue} ${durationUnit}`
              }
            />
            {ratePreview !== null && (
              <ReviewRow
                label="Rate"
                value={`${ratePreview.perSecond} XLM / second`}
              />
            )}
            {balanceAfter !== null && (
              <ReviewRow
                label="Your balance after"
                value={`${stroopsToXlm(balanceAfter, { group: true })} XLM`}
              />
            )}
          </dl>

          {submitError !== null && (
            <div className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {submitError}
              {needsFunding && (
                <>
                  {" "}
                  <a
                    href={friendbotUrl(employer)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium underline"
                  >
                    Add free test funds (testnet)
                  </a>
                  .
                </>
              )}
            </div>
          )}

          <div className="mt-5 flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setReviewing(false)}
              disabled={working}
              className="flex-1"
            >
              Back
            </Button>
            <Button
              onClick={() => void handleConfirm()}
              disabled={working}
              className="flex-1"
            >
              {working
                ? (statusMessage ?? "Working...")
                : "Confirm and approve"}
            </Button>
          </div>
        </Dialog>
      )}
    </form>
  );
}

function ReviewRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}

function CreatedScreen({
  streamId,
  hash,
  workerAddress,
  onReset,
}: {
  streamId: bigint;
  hash: string;
  workerAddress: string;
  onReset: () => void;
}) {
  const streamLink = `${window.location.origin}/worker/${streamId.toString()}`;
  const businessName = getBusinessName();
  const shareText =
    businessName === null
      ? "Watch your pay come in and cash out anytime:"
      : `${businessName} started paying you. Watch it come in and cash out anytime:`;
  const [copied, setCopied] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saved, setSaved] = useState(false);

  function copyLink(): void {
    void navigator.clipboard.writeText(streamLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">
        Paycheck #{streamId.toString()} started
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        This paycheck is live and already earning. Send your worker their link
        so they can watch it and cash out.
      </p>

      <div className="mt-4 flex flex-col items-center gap-3 rounded-xl bg-slate-50 p-4 sm:flex-row sm:items-start">
        <QrCode
          value={streamLink}
          size={128}
          label="QR code of the stream link"
        />
        <div className="w-full flex-1 space-y-2">
          <p className="break-all font-mono text-xs text-slate-700">
            {streamLink}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={copyLink}>
              {copied ? "Copied" : "Copy link"}
            </Button>
            <ShareButton
              title="Your StreamPay paycheck"
              text={shareText}
              url={streamLink}
              className="!px-3 !py-1.5 !text-sm"
            >
              Send to worker
            </ShareButton>
          </div>
        </div>
      </div>

      {workerAddress !== "" && (
        <div className="mt-4">
          {saved ? (
            <p className="text-sm text-teal-700">Worker saved for next time.</p>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1">
                <label
                  htmlFor="save-name"
                  className="block text-xs font-medium text-slate-500"
                >
                  Save this worker (optional)
                </label>
                <input
                  id="save-name"
                  value={saveName}
                  onChange={(event) => setSaveName(event.target.value)}
                  placeholder="Name, e.g. Maria"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
                />
              </div>
              <Button
                variant="secondary"
                disabled={saveName.trim() === ""}
                onClick={() => {
                  saveWorker(saveName, workerAddress);
                  setSaved(true);
                }}
              >
                Save
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <a
          href={explorerTxUrl(hash)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-400"
        >
          View public receipt
        </a>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-400"
        >
          Create another
        </button>
      </div>
    </div>
  );
}

function computeRatePreview(
  amountText: string,
  durationSeconds: number,
): { perSecond: string; perDay: string } | null {
  if (durationSeconds <= 0) {
    return null;
  }
  let deposit: bigint;
  try {
    deposit = xlmToStroops(amountText);
  } catch {
    return null;
  }
  if (deposit <= 0n) {
    return null;
  }
  const perSecond = perSecondStroops(deposit, BigInt(durationSeconds));
  return {
    perSecond: stroopsToXlm(perSecond, { fractionDigits: 7 }),
    perDay: stroopsToXlm(perSecond * 86_400n, { group: true }),
  };
}

function describeError(error: unknown): string {
  if (error instanceof SignError) {
    return "Approval declined. Your inputs are kept; approve when ready.";
  }
  if (error instanceof SubmitError) {
    return error.message;
  }
  if (error instanceof ChainError) {
    return "That did not go through. Check the amount and try again.";
  }
  return "Something went wrong. Your inputs are kept; try again.";
}
