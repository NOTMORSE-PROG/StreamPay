import { useState } from "react";
import { useEmployerStreams } from "../../hooks/useEmployerStreams";
import {
  getNickname,
  matchesSearch,
  matchesStatusFilter,
  summarize,
  type StatusFilter,
} from "../../lib/streams";
import { stroopsToXlm } from "../../lib/format";
import {
  downloadCsv,
  EMPLOYER_EXPORT_HEADERS,
  employerExportRows,
  exportFilename,
  toCsv,
} from "../../lib/csv";
import { StreamList } from "../../components/StreamList";
import { PageHeading } from "../../components/ui/PageHeading";
import { Stat } from "../../components/ui/Stat";
import { Card } from "../../components/ui/Card";
import { Button, ButtonLink } from "../../components/ui/Button";
import { cx } from "../../components/ui/cx";
import { InvitePanel } from "../../components/employer/InvitePanel";
import { useEmployerContext } from "../../components/employer/context";

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

// The employer's home once signed in: a summary stat row (active streams, XLM
// streaming now, total ever deposited) computed from the same rows the list
// polls, then the stream list itself. Creating a stream lives on its own route.

export function Dashboard() {
  const { address, refreshKey, onChanged } = useEmployerContext();
  const { rows, loading, error } = useEmployerStreams(address, refreshKey);
  const summary = summarize(rows);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");

  const filteredRows = rows.filter(
    (row) =>
      matchesStatusFilter(row.state, statusFilter) &&
      matchesSearch(row, query, getNickname(row.stream.id)),
  );

  // Accounting export (T-039): exactly the rows the current filter shows, as
  // the chain figures the list displays, never the animated values.
  const exportCsv = () => {
    downloadCsv(
      exportFilename("streams"),
      toCsv(
        EMPLOYER_EXPORT_HEADERS,
        employerExportRows(filteredRows, getNickname),
      ),
    );
  };

  return (
    <div className="space-y-6">
      <PageHeading
        title="Dashboard"
        subtitle="Set aside a pay period once; wages flow to your workers every second."
        action={
          <ButtonLink to="/employer/create" size="lg">
            Create stream
          </ButtonLink>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Active streams"
          value={summary.activeCount}
          hint="Currently paying a worker"
        />
        <Stat
          label="Streaming now"
          value={`${stroopsToXlm(summary.totalStreaming, { group: true })} XLM`}
          hint="Money in flight across active streams"
        />
        <Stat
          label="Total deposited"
          value={`${stroopsToXlm(summary.totalDeposited, { group: true })} XLM`}
          hint="Across every stream you have funded"
        />
      </div>

      {!loading && rows.length === 0 ? (
        <GettingStarted />
      ) : (
        <div className="space-y-4">
          {rows.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap gap-1">
                {FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setStatusFilter(f.value)}
                    className={cx(
                      "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                      statusFilter === f.value
                        ? "bg-teal-50 text-teal-700"
                        : "text-slate-500 hover:text-slate-800",
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name or address"
                aria-label="Search streams"
                className="ml-auto w-full max-w-xs rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-teal-500 focus:outline-none sm:w-56"
              />
              {filteredRows.length > 0 && (
                <Button variant="secondary" size="sm" onClick={exportCsv}>
                  Export CSV
                </Button>
              )}
            </div>
          )}
          <StreamList
            employer={address}
            rows={filteredRows}
            loading={loading}
            error={error}
            onChanged={onChanged}
          />
          {rows.length > 0 && filteredRows.length === 0 && (
            <p className="text-sm text-slate-500">
              No streams match this filter.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function GettingStarted() {
  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Start paying per second
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Three steps to your first salary stream.
          </p>
        </div>
        <ol className="space-y-3">
          <ChecklistItem
            n="1"
            title="Invite your worker"
            body="Send them the worker app below. They set up an account and send you their account number."
          />
          <ChecklistItem
            n="2"
            title="Add their account number"
            body="Paste the account number into the create form, or pick a saved worker."
          />
          <ChecklistItem
            n="3"
            title="Fund and start"
            body="Set aside a pay period once; wages flow to them every second."
          />
        </ol>
        <ButtonLink to="/employer/create" size="lg" className="w-full">
          Create your first stream
        </ButtonLink>
      </Card>
      <InvitePanel />
    </div>
  );
}

function ChecklistItem({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-bold text-teal-700">
        {n}
      </span>
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-sm text-slate-500">{body}</p>
      </div>
    </li>
  );
}
