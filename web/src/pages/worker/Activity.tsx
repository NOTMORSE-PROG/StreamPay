import { getNickname } from "../../lib/streams";
import { getAllReceipts } from "../../lib/withdraw";
import { stroopsToXlm } from "../../lib/format";
import { explorerTxUrl } from "../../lib/config";
import {
  ACTIVITY_EXPORT_HEADERS,
  activityExportRows,
  downloadCsv,
  exportFilename,
  toCsv,
} from "../../lib/csv";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";

// The worker's Activity tab: every withdrawal they have made across all streams,
// newest first, each with an explorer receipt link (the verifiable "not a black
// box" history). Reads the browser-local receipt trail, which the withdraw path
// writes on each successful withdrawal.

function relativeTime(atMs: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - atMs) / 1000));
  if (seconds < 60) {
    return "just now";
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes.toString()} min ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours.toString()} h ago`;
  }
  const days = Math.round(hours / 24);
  return `${days.toString()} d ago`;
}

export function Activity() {
  const receipts = getAllReceipts();

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Activity
          </h1>
          <p className="text-sm text-slate-500">
            Every cash-out you have made, with a public receipt you can verify
            yourself.
          </p>
        </div>
        {receipts.length > 0 && (
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0"
            onClick={() => {
              // Accounting export (T-039): the stored receipt trail, each row
              // carrying its explorer URL.
              downloadCsv(
                exportFilename("activity"),
                toCsv(
                  ACTIVITY_EXPORT_HEADERS,
                  activityExportRows(receipts, getNickname),
                ),
              );
            }}
          >
            Export CSV
          </Button>
        )}
      </header>

      {receipts.length === 0 ? (
        <Card dashed className="p-6 text-center">
          <p className="text-sm text-slate-600">
            No cash-outs yet. When you cash out, it shows up here with a public
            receipt.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {receipts.map(({ streamId, receipt }) => {
            const label =
              getNickname(streamId) ?? `Paycheck #${streamId.toString()}`;
            return (
              <li
                key={receipt.hash}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="min-w-0">
                  <p className="font-semibold tabular-nums text-slate-900">
                    {stroopsToXlm(BigInt(receipt.amountStroops), {
                      group: true,
                    })}{" "}
                    XLM
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {label} · {relativeTime(receipt.atMs)}
                  </p>
                </div>
                <a
                  href={explorerTxUrl(receipt.hash)}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-sm font-medium text-teal-700 hover:text-teal-800"
                >
                  Receipt
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
