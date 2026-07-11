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
import { stroopsToXlm, xlmToStroops } from "../lib/format";
import { explorerTxUrl, friendbotUrl } from "../lib/config";

// The employer's core action (15 seconds in the demo): enter a worker address, a
// total amount, and a duration; watch the live per-second rate; sign in Freighter;
// see the on-chain receipt. Start is derived from chain time, never Date.now()
// (T-008 finding). Form contents survive every error so a decline or RPC hiccup is
// a retry, not a re-type.

interface CreateStreamFormProps {
  employer: string;
  onCreated: (streamId: bigint) => void;
}

type DurationUnit = "minutes" | "hours";
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
}: CreateStreamFormProps) {
  const [workerAddress, setWorkerAddress] = useState("");
  const [amountText, setAmountText] = useState("");
  const [durationValue, setDurationValue] = useState("10");
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("minutes");

  const [fieldError, setFieldError] = useState<{
    field: FieldName;
    message: string;
  } | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [needsFunding, setNeedsFunding] = useState(false);
  const [created, setCreated] = useState<{
    streamId: bigint;
    hash: string;
  } | null>(null);

  const durationSeconds =
    Math.round(Number(durationValue)) * UNIT_SECONDS[durationUnit];
  const ratePreview = computeRatePreview(amountText, durationSeconds);

  async function handleSubmit(
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
    const worker = workerAddress.trim();

    setPhase("working");
    try {
      setStatusMessage("Checking the network...");
      const wallet = await resolveWalletStatus();
      if (wallet.kind === "wrong-network") {
        setPhase("error");
        setSubmitError("Switch Freighter to Testnet, then try again.");
        return;
      }
      if (wallet.kind !== "connected" || wallet.address !== employer) {
        setPhase("error");
        setSubmitError("Reconnect your wallet, then try again.");
        return;
      }

      if (!(await accountExists(worker))) {
        setPhase("idle");
        setFieldError({
          field: "worker",
          message:
            "That account does not exist yet. Ask the worker to open the /worker page first; it sets them up.",
        });
        return;
      }

      const balance = await getTokenBalance(employer);
      if (balance < validation.deposit) {
        setPhase("error");
        setNeedsFunding(true);
        setSubmitError(
          `Your balance (${stroopsToXlm(balance)} XLM) is less than the deposit.`,
        );
        return;
      }

      setStatusMessage("Waiting for your signature in Freighter...");
      const start = await getChainTime();
      const result = await createStream({
        employer,
        worker,
        deposit: validation.deposit,
        start,
        duration: validation.durationSeconds,
        signXdr: (xdr) => signWithFreighter(xdr, employer),
      });

      setCreated(result);
      setPhase("success");
      setStatusMessage(null);
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
    setAmountText("");
    setWorkerAddress("");
  }

  if (phase === "success" && created !== null) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Stream created</h2>
        <p className="mt-1 text-sm text-slate-600">
          Stream #{created.streamId.toString()} is live and already accruing.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={explorerTxUrl(created.hash)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            View on explorer
          </a>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-400"
          >
            Create another
          </button>
        </div>
      </div>
    );
  }

  const working = phase === "working";

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="rounded-2xl border border-slate-200 bg-white p-6"
    >
      <h2 className="text-lg font-semibold text-slate-900">Create a stream</h2>
      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor="worker" className={labelClass}>
            Worker address
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
          <span className="text-slate-500">Streaming rate</span>
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

        {submitError !== null && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
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
                  Fund it with friendbot (testnet)
                </a>
                .
              </>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={working}
          className="inline-flex w-full items-center justify-center rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {working ? (statusMessage ?? "Working...") : "Create stream"}
        </button>
      </div>
    </form>
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
    return "Signature declined. Your inputs are kept; sign when ready.";
  }
  if (error instanceof SubmitError) {
    return error.message;
  }
  if (error instanceof ChainError) {
    return "The network rejected the stream. Check the amount and try again.";
  }
  return "Something went wrong. Your inputs are kept; try again.";
}
