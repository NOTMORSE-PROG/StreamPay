import { useState } from "react";
import { Link } from "react-router-dom";
import { getNickname, progressPercent, setNickname } from "../lib/streams";
import type { StreamRow } from "../lib/streams";
import {
  formatDuration,
  stroopsToXlm,
  stroopsToXlmCompact,
  truncateAddress,
} from "../lib/format";
import {
  CONTRACT_ID,
  explorerAccountUrl,
  explorerContractUrl,
} from "../lib/config";
import { CancelDialog } from "./CancelDialog";
import { Card } from "./ui/Card";
import { StatusBadge } from "./ui/StatusBadge";

// The employer's overview: every stream they created, each with a live accrued
// figure, a lifecycle badge, an editable nickname, the shareable worker link, and
// a Cancel action with the fair-split confirmation (T-015). The rows are loaded
// and polled by the parent dashboard (useEmployerStreams) and passed in, so the
// dashboard can also compute its summary stat row from the same data.

interface StreamListProps {
  employer: string;
  rows: StreamRow[];
  loading: boolean;
  error: string | null;
  /** Force a full re-read after a stream's state changes (a cancel). */
  onChanged: () => void;
}

export function StreamList({
  employer,
  rows,
  loading,
  error,
  onChanged,
}: StreamListProps) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">
        Workers you are paying
      </h2>

      {error !== null && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">
          {error}
        </p>
      )}

      {loading && rows.length === 0 ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : rows.length === 0 ? (
        <Card dashed className="p-8 text-center">
          <p className="text-sm text-slate-500">
            No one yet. Use Create stream to start paying a worker per second.
          </p>
        </Card>
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
  // Ended streams can be renewed: prefill the create form for the next pay period.
  const ended = state === "drained" || state === "cancelled";
  const renewLink =
    `/employer/create?worker=${encodeURIComponent(stream.worker)}` +
    `&amount=${stroopsToXlm(stream.deposit)}` +
    `&durationSeconds=${stream.duration.toString()}`;

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <NicknameField streamId={stream.id} />
        <StatusBadge state={state} />
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
          <dt className="text-slate-500">Set aside</dt>
          <dd className="mt-0.5 break-words tabular-nums text-slate-900">
            {stroopsToXlmCompact(stream.deposit)} XLM
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Duration</dt>
          <dd className="mt-0.5 tabular-nums text-slate-900">
            {formatDuration(stream.duration)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Earned so far</dt>
          <dd className="mt-0.5 break-words font-semibold tabular-nums text-slate-900">
            {stroopsToXlmCompact(accrued)} XLM
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
          {percent}% paid out
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
          Public receipt
        </a>
        {cancellable && (
          <button
            type="button"
            onClick={() => setCancelOpen(true)}
            className="ml-auto font-medium text-amber-700 hover:text-amber-800"
          >
            Stop paying
          </button>
        )}
        {ended && (
          <Link
            to={renewLink}
            className="ml-auto font-medium text-teal-700 hover:text-teal-800"
          >
            Start next period
          </Link>
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
