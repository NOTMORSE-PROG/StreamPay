import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useWorkerStream } from "../../hooks/useWorkerStream";
import { useWorkerContext } from "../../components/worker/context";
import { TickingBalance } from "../../components/TickingBalance";
import { WithdrawPanel } from "../../components/WithdrawPanel";
import { ratePerSecond, withdrawableStroops } from "../../lib/accrual";
import {
  formatDuration,
  stroopsToXlmCompact,
  truncateAddress,
} from "../../lib/format";
import { explorerAccountUrl } from "../../lib/config";
import { getEmployerLabel, setEmployerLabel } from "../../lib/employerLabels";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { CurrencyToggle } from "../../components/worker/CurrencyToggle";
import { useDisplayCurrency } from "../../hooks/useDisplayCurrency";
import { formatInCurrency, isConverted } from "../../lib/currency";
import type { LifecycleState } from "../../lib/streams";
import type { Stream } from "../../lib/contract";

// The single-stream detail (/worker/:streamId): the big per-second ticking balance
// (T-013), the withdraw button and explorer receipt (T-014), and the honest end
// states (T-015). Moved from the old WorkerView into the worker shell; it now
// takes the demo wallet from the shell context instead of loading its own.

const STALE_AFTER_MS = 13_000; // ~2 missed polls: show a reconnecting note.

export function StreamDetail() {
  const { streamId } = useParams<{ streamId: string }>();
  const worker = useWorkerStream(streamId);

  if (worker.error === "invalid") {
    return (
      <WorkerMessage
        title="That paycheck link looks wrong"
        body="A paycheck link ends in a plain number, like /worker/2. Ask your employer to resend it."
      />
    );
  }

  if (worker.loading && worker.stream === null) {
    return (
      <WorkerMessage
        title="Loading your paycheck"
        body="Getting the latest amount..."
      />
    );
  }

  if (
    worker.error === "load-failed" ||
    worker.stream === null ||
    worker.state === null
  ) {
    return (
      <WorkerMessage
        title="We could not load this paycheck"
        body="It may not exist yet, or the connection dropped. Check the link with your employer, or try again shortly."
      />
    );
  }

  return (
    <WorkerStreamCard
      stream={worker.stream}
      chainAccrued={worker.chainAccrued}
      anchorLedgerSeconds={worker.anchorLedgerSeconds}
      anchorMs={worker.anchorMs}
      state={worker.state}
      lastSyncedMs={worker.lastSyncedMs}
      onWithdrawn={worker.refresh}
    />
  );
}

interface CardProps {
  stream: Stream;
  chainAccrued: bigint;
  anchorLedgerSeconds: bigint;
  anchorMs: number;
  state: LifecycleState;
  lastSyncedMs: number | null;
  onWithdrawn: () => void;
}

function WorkerStreamCard({
  stream,
  chainAccrued,
  anchorLedgerSeconds,
  anchorMs,
  state,
  lastSyncedMs,
  onWithdrawn,
}: CardProps) {
  const { wallet } = useWorkerContext();
  const { currency, setCurrency } = useDisplayCurrency();
  const ticking = state === "active";
  const available = withdrawableStroops(stream, chainAccrued);
  const rate = ratePerSecond(stream);

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <Link
            to="/worker"
            className="text-sm font-medium text-slate-500 hover:text-teal-700"
          >
            &larr; Your earnings
          </Link>
          <p className="text-xs text-slate-400 tabular-nums">
            Paycheck #{stream.id.toString()}
          </p>
        </div>
        <StatusBadge state={state} context="worker" />
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Earned so far
          </p>
          <CurrencyToggle currency={currency} onChange={setCurrency} />
        </div>
        <p className="mt-3">
          <TickingBalance
            stream={stream}
            chainAccrued={chainAccrued}
            anchorLedgerSeconds={anchorLedgerSeconds}
            anchorMs={anchorMs}
            ticking={ticking}
          />
          <span className="mt-1 block text-sm font-medium text-slate-400">
            XLM
          </span>
        </p>
        {isConverted(currency) && (
          <p className="mt-1 text-sm text-slate-500 tabular-nums">
            ≈ {formatInCurrency(chainAccrued, currency)}{" "}
            <span className="text-xs text-slate-400">(demo rate)</span>
          </p>
        )}
        {ticking && rate > 0n && (
          <p className="mt-3 text-sm text-teal-700 tabular-nums">
            +{stroopsToXlmCompact(rate)} XLM per second
          </p>
        )}
        <EndStateNote
          state={state}
          stream={stream}
          chainAccrued={chainAccrued}
        />
      </section>

      <WithdrawPanel
        stream={stream}
        available={available}
        state={state}
        wallet={wallet}
        onWithdrawn={onWithdrawn}
      />

      <StreamMeta stream={stream} rate={rate} />
      <SyncIndicator lastSyncedMs={lastSyncedMs} />

      <p className="text-center text-xs text-slate-400">
        Demo account in test mode. These are real amounts in test tokens
        (test-XLM), not real money.{" "}
        <Link to="/worker/wallet" className="text-teal-700 hover:text-teal-800">
          Your account
        </Link>
      </p>
    </div>
  );
}

function EndStateNote({
  state,
  stream,
  chainAccrued,
}: {
  state: LifecycleState;
  stream: Stream;
  chainAccrued: bigint;
}) {
  if (state === "active") {
    return null;
  }
  const earned = stroopsToXlmCompact(chainAccrued);
  const text =
    state === "cancelled"
      ? `This paycheck was stopped. Your earned ${earned} XLM was paid to your account when it stopped.`
      : state === "drained"
        ? "Fully paid out. Nothing left to collect."
        : `Finished. Your remaining ${stroopsToXlmCompact(
            withdrawableStroops(stream, chainAccrued),
          )} XLM is still yours to cash out.`;
  return <p className="mt-4 text-sm text-slate-500">{text}</p>;
}

function StreamMeta({ stream, rate }: { stream: Stream; rate: bigint }) {
  return (
    <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm">
      <div>
        <dt className="text-slate-500">Total for this paycheck</dt>
        <dd className="mt-0.5 break-words tabular-nums text-slate-900">
          {stroopsToXlmCompact(stream.deposit)} XLM
        </dd>
      </div>
      <div>
        <dt className="text-slate-500">Over</dt>
        <dd className="mt-0.5 tabular-nums text-slate-900">
          {formatDuration(stream.duration)}
        </dd>
      </div>
      <div>
        <dt className="text-slate-500">Rate</dt>
        <dd className="mt-0.5 break-words tabular-nums text-slate-900">
          {stroopsToXlmCompact(rate)} XLM/s
        </dd>
      </div>
      <div>
        <dt className="text-slate-500">Already cashed out</dt>
        <dd className="mt-0.5 break-words tabular-nums text-slate-900">
          {stroopsToXlmCompact(stream.withdrawn)} XLM
        </dd>
      </div>
      <div>
        <dt className="text-slate-500">Paid to</dt>
        <dd className="mt-0.5">
          <a
            href={explorerAccountUrl(stream.worker)}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-slate-700 hover:text-teal-700"
            title={stream.worker}
          >
            {truncateAddress(stream.worker, 6)}
          </a>
        </dd>
      </div>
      <PaidByField employer={stream.employer} />
    </dl>
  );
}

function PaidByField({ employer }: { employer: string }) {
  const [label, setLabel] = useState(() => getEmployerLabel(employer));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label ?? "");

  function save(): void {
    setEmployerLabel(employer, draft);
    setLabel(getEmployerLabel(employer));
    setEditing(false);
  }

  return (
    <div>
      <dt className="text-slate-500">Paid by</dt>
      <dd className="mt-0.5">
        {editing ? (
          <span className="flex items-center gap-2">
            <input
              aria-label="Name this employer"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Name this employer"
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={save}
              className="text-sm font-medium text-teal-700"
            >
              Save
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(label ?? "");
              setEditing(true);
            }}
            className="text-left text-slate-700 hover:text-teal-700"
          >
            {label ?? (
              <span className="font-mono">
                {truncateAddress(employer, 6)}{" "}
                <span className="font-sans text-xs text-teal-700">
                  (name this employer)
                </span>
              </span>
            )}
          </button>
        )}
      </dd>
    </div>
  );
}

function SyncIndicator({ lastSyncedMs }: { lastSyncedMs: number | null }) {
  // A once-per-second re-render just to age the freshness note. This never
  // touches the money number (that ticks via requestAnimationFrame in
  // TickingBalance); it only decides between "Live" and "Reconnecting".
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (lastSyncedMs === null) {
    return null;
  }
  const ageMs = nowMs - lastSyncedMs;
  const stale = ageMs > STALE_AFTER_MS;
  const seconds = Math.max(0, Math.round(ageMs / 1000));

  return (
    <p className="flex items-center justify-center gap-2 text-xs text-slate-400">
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${stale ? "bg-amber-400" : "bg-teal-500"}`}
      />
      {stale
        ? `Reconnecting, last updated ${seconds}s ago`
        : "Live, updating in real time"}
    </p>
  );
}

function WorkerMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-3 py-6 text-center">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">
        {title}
      </h1>
      <p className="text-sm text-slate-500">{body}</p>
      <Link
        to="/worker"
        className="inline-block text-sm font-medium text-teal-700 hover:text-teal-800"
      >
        Go to your earnings
      </Link>
    </div>
  );
}
