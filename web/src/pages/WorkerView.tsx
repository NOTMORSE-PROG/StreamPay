import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useWorkerStream } from "../hooks/useWorkerStream";
import { TickingBalance } from "../components/TickingBalance";
import { WithdrawPanel } from "../components/WithdrawPanel";
import { ratePerSecond, withdrawableStroops } from "../lib/accrual";
import { loadOrCreateDemoWallet, type DemoWallet } from "../lib/demoWallet";
import { formatDuration, stroopsToXlm, truncateAddress } from "../lib/format";
import { explorerAccountUrl } from "../lib/config";
import type { LifecycleState } from "../lib/streams";
import type { Stream } from "../lib/contract";

// The worker stream route (/worker/:streamId): the big ticking balance (T-013),
// the withdraw button and explorer receipt (T-014), and the honest end states
// (T-015). Phone-first (max-w-sm): the demo shows this on a real phone.

const STALE_AFTER_MS = 13_000; // ~2 missed polls: show a reconnecting note.

export function WorkerView() {
  const { streamId } = useParams<{ streamId: string }>();
  const worker = useWorkerStream(streamId);

  if (worker.error === "invalid") {
    return (
      <WorkerMessage
        title="That stream link looks wrong"
        body="A stream id is a plain number, like /worker/2. Ask your employer to resend the link."
      />
    );
  }

  if (worker.loading && worker.stream === null) {
    return (
      <WorkerMessage
        title="Loading your stream"
        body="Reading the latest from the network..."
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
        title="We could not load this stream"
        body="It may not exist yet, or the network is unreachable. Check the link with your employer, or try again shortly."
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
  const ticking = state === "active";
  const available = withdrawableStroops(stream, chainAccrued);
  const rate = ratePerSecond(stream);

  // Load the worker's demo wallet so the withdraw panel can sign (and so it can
  // tell whether this browser owns the stream, ENGINEERING.md decision 11).
  const [wallet, setWallet] = useState<DemoWallet | null>(null);
  useEffect(() => {
    setWallet(loadOrCreateDemoWallet());
  }, []);

  return (
    <div className="mx-auto max-w-sm space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Your earnings</p>
          <p className="text-xs text-slate-400 tabular-nums">
            Stream #{stream.id.toString()}
          </p>
        </div>
        <StatusBadge state={state} />
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Earned so far
        </p>
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
        {ticking && rate > 0n && (
          <p className="mt-3 text-sm text-teal-700 tabular-nums">
            +{stroopsToXlm(rate)} XLM per second
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
        Demo wallet on Stellar testnet. Numbers are real on-chain wages in test
        XLM.{" "}
        <Link to="/worker" className="text-teal-700 hover:text-teal-800">
          Set up a wallet
        </Link>
      </p>
    </div>
  );
}

const BADGE: Record<LifecycleState, { label: string; className: string }> = {
  active: { label: "Streaming", className: "bg-teal-50 text-teal-700" },
  completed: { label: "Completed", className: "bg-blue-50 text-blue-700" },
  drained: { label: "Drained", className: "bg-slate-100 text-slate-600" },
  cancelled: { label: "Cancelled", className: "bg-amber-50 text-amber-700" },
};

function StatusBadge({ state }: { state: LifecycleState }) {
  const badge = BADGE[state];
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}
    >
      {badge.label}
    </span>
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
  const earned = stroopsToXlm(chainAccrued, { group: true });
  const text =
    state === "cancelled"
      ? `This stream was cancelled. Your earned ${earned} XLM was paid to your wallet by the cancel.`
      : state === "drained"
        ? "Fully vested and fully withdrawn. Nothing left to collect."
        : `Fully vested. Your remaining ${stroopsToXlm(
            withdrawableStroops(stream, chainAccrued),
            { group: true },
          )} XLM is still yours to withdraw.`;
  return <p className="mt-4 text-sm text-slate-500">{text}</p>;
}

function StreamMeta({ stream, rate }: { stream: Stream; rate: bigint }) {
  return (
    <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm">
      <div>
        <dt className="text-slate-500">Total this stream</dt>
        <dd className="mt-0.5 tabular-nums text-slate-900">
          {stroopsToXlm(stream.deposit, { group: true })} XLM
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
        <dd className="mt-0.5 tabular-nums text-slate-900">
          {stroopsToXlm(rate)} XLM/s
        </dd>
      </div>
      <div>
        <dt className="text-slate-500">Already withdrawn</dt>
        <dd className="mt-0.5 tabular-nums text-slate-900">
          {stroopsToXlm(stream.withdrawn, { group: true })} XLM
        </dd>
      </div>
      <div className="col-span-2">
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
    </dl>
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
        ? `Reconnecting, last synced ${seconds}s ago`
        : "Live from the Stellar testnet"}
    </p>
  );
}

function WorkerMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-sm space-y-3 text-center">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">
        {title}
      </h1>
      <p className="text-sm text-slate-500">{body}</p>
      <Link
        to="/worker"
        className="inline-block text-sm font-medium text-teal-700 hover:text-teal-800"
      >
        Go to your wallet
      </Link>
    </div>
  );
}
