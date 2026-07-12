import { useState } from "react";
import { useEmployerStreams } from "../hooks/useEmployerStreams";
import {
  getNickname,
  lifecycleLabel,
  progressPercent,
  setNickname,
  summarize,
  type LifecycleState,
  type StreamRow,
} from "../lib/streams";
import { formatDuration, stroopsToXlm, truncateAddress } from "../lib/format";
import {
  CONTRACT_ID,
  explorerAccountUrl,
  explorerContractUrl,
} from "../lib/config";
import { CancelDialog } from "./CancelDialog";

// The employer's overview: every stream they created, each with a live accrued
// figure, a lifecycle badge, an editable nickname, the shareable worker link, and
// a Cancel action with the fair-split confirmation (T-015). Reads are free
// simulations polled on a polite cadence (useEmployerStreams).

interface StreamListProps {
  employer: string;
  refreshKey: number;
  /** Force a full re-read after a stream's state changes (a cancel). */
  onChanged: () => void;
}

const BADGE_CLASS: Record<LifecycleState, string> = {
  active: "bg-teal-50 text-teal-700",
  completed: "bg-blue-50 text-blue-700",
  drained: "bg-slate-100 text-slate-600",
  cancelled: "bg-amber-50 text-amber-700",
};

export function StreamList({
  employer,
  refreshKey,
  onChanged,
}: StreamListProps) {
  const { rows, loading, error } = useEmployerStreams(employer, refreshKey);
  const summary = summarize(rows);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">Your streams</h2>
        <p className="text-sm text-slate-500 tabular-nums">
          {summary.activeCount} active ·{" "}
          {stroopsToXlm(summary.totalStreaming, { group: true })} XLM streaming
        </p>
      </div>

      {error !== null && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">
          {error}
        </p>
      )}

      {loading && rows.length === 0 ? (
        <p className="text-sm text-slate-500">Loading streams...</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm text-slate-500">
            No streams yet. Create one above to start paying a worker per
            second.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <StreamCard
              key={row.stream.id.toString()}
              row={row}
              employer={employer}
              onChanged={onChanged}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function StreamCard({
  row,
  employer,
  onChanged,
}: {
  row: StreamRow;
  employer: string;
  onChanged: () => void;
}) {
  const { stream, accrued, state } = row;
  const percent = progressPercent(stream, accrued);
  const workerLink = `${window.location.origin}/worker/${stream.id.toString()}`;
  const [cancelOpen, setCancelOpen] = useState(false);
  // Cancel is meaningful only while the stream can still move money: active
  // (splits earned vs remainder) or completed (pays the worker the remainder).
  // Drained and cancelled are terminal, so no button (the client-side block).
  const cancellable = state === "active" || state === "completed";

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <NicknameField streamId={stream.id} />
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE_CLASS[state]}`}
        >
          {lifecycleLabel(state)}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-slate-500">Worker</dt>
          <dd className="mt-0.5">
            <a
              href={explorerAccountUrl(stream.worker)}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-slate-700 hover:text-teal-700"
              title={stream.worker}
            >
              {truncateAddress(stream.worker)}
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Deposit</dt>
          <dd className="mt-0.5 tabular-nums text-slate-900">
            {stroopsToXlm(stream.deposit, { group: true })} XLM
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Duration</dt>
          <dd className="mt-0.5 tabular-nums text-slate-900">
            {formatDuration(stream.duration)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Accrued</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">
            {stroopsToXlm(accrued, { group: true })} XLM
          </dd>
        </div>
      </dl>

      <div className="mt-4">
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-teal-500"
            style={{ width: `${percent.toString()}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-slate-500 tabular-nums">
          {percent}% vested
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <CopyLinkButton link={workerLink} />
        <a
          href={explorerContractUrl(CONTRACT_ID)}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-slate-600 hover:text-teal-700"
        >
          Contract on explorer
        </a>
        {cancellable && (
          <button
            type="button"
            onClick={() => setCancelOpen(true)}
            className="ml-auto font-medium text-amber-700 hover:text-amber-800"
          >
            Cancel stream
          </button>
        )}
      </div>

      {cancelOpen && (
        <CancelDialog
          stream={stream}
          accrued={accrued}
          employer={employer}
          onCancelled={onChanged}
          onClose={() => setCancelOpen(false)}
        />
      )}
    </li>
  );
}

function NicknameField({ streamId }: { streamId: bigint }) {
  const [value, setValue] = useState(() => getNickname(streamId) ?? "");
  return (
    <input
      aria-label={`Nickname for stream ${streamId.toString()}`}
      value={value}
      onChange={(event) => {
        setValue(event.target.value);
        setNickname(streamId, event.target.value);
      }}
      placeholder={`Stream #${streamId.toString()}`}
      className="w-full max-w-xs rounded-md border border-transparent px-1 py-0.5 text-base font-semibold text-slate-900 hover:border-slate-200 focus:border-teal-500 focus:outline-none"
    />
  );
}

function CopyLinkButton({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(link).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="font-medium text-teal-700 hover:text-teal-800"
    >
      {copied ? "Link copied" : "Copy worker link"}
    </button>
  );
}
