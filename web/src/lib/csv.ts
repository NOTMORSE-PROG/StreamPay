// Accounting CSV export (T-039): pure serialization + the two row mappers
// (employer stream list, worker receipt trail), kept out of the components so
// the money formatting and the injection defense are unit-tested. Amounts go
// through stroopsToXlm (integer-safe, I-7 truncation), never floats, and only
// chain-read state and stored receipts are exported, never the animated
// display values.

import { explorerTxUrl } from "./config";
import { stroopsToXlm } from "./format";
import { ratePerSecond } from "./accrual";
import { lifecycleLabel, type StreamRow } from "./streams";
import type { StreamReceipt } from "./withdraw";

/**
 * Escape one CSV field: RFC 4180 quoting (fields containing commas, quotes,
 * or newlines are wrapped in double quotes, inner quotes doubled), plus the
 * OWASP formula-injection defense: a field starting with =, +, - or @ gets a
 * leading apostrophe so spreadsheet apps treat it as text, never as a formula.
 */
export function csvField(value: string): string {
  let field = value;
  if (/^[=+@-]/.test(field)) {
    field = `'${field}`;
  }
  if (/[",\r\n]/.test(field)) {
    field = `"${field.replaceAll('"', '""')}"`;
  }
  return field;
}

/**
 * Serialize a header row plus data rows into CSV text: RFC 4180 CRLF line
 * endings, every field escaped. Empty rows input yields a header-only file.
 */
export function toCsv(
  headers: readonly string[],
  rows: readonly (readonly string[])[],
): string {
  const lines = [headers, ...rows].map((row) => row.map(csvField).join(","));
  return lines.join("\r\n") + "\r\n";
}

export const EMPLOYER_EXPORT_HEADERS = [
  "stream_id",
  "nickname",
  "worker_address",
  "status",
  "deposit_xlm",
  "accrued_xlm",
  "withdrawn_xlm",
  "start_utc",
  "duration_seconds",
  "rate_xlm_per_second",
] as const;

/**
 * The employer's accounting rows, one per (already filtered) dashboard row.
 * Amounts are the exact chain figures the dashboard shows; the rate reuses
 * ratePerSecond (the same floor math as the contract).
 */
export function employerExportRows(
  rows: readonly StreamRow[],
  nicknameOf: (streamId: bigint) => string | null,
): string[][] {
  return rows.map((row) => [
    row.stream.id.toString(),
    nicknameOf(row.stream.id) ?? "",
    row.stream.worker,
    lifecycleLabel(row.state),
    stroopsToXlm(row.stream.deposit),
    stroopsToXlm(row.accrued),
    stroopsToXlm(row.stream.withdrawn),
    new Date(Number(row.stream.start) * 1000).toISOString(),
    row.stream.duration.toString(),
    stroopsToXlm(ratePerSecond(row.stream), { fractionDigits: 7 }),
  ]);
}

export const ACTIVITY_EXPORT_HEADERS = [
  "stream_id",
  "nickname",
  "amount_xlm",
  "withdrawn_at_utc",
  "transaction_hash",
  "explorer_url",
] as const;

/** The worker's withdrawal history rows, one per stored receipt. */
export function activityExportRows(
  receipts: readonly StreamReceipt[],
  nicknameOf: (streamId: bigint) => string | null,
): string[][] {
  return receipts.map(({ streamId, receipt }) => [
    streamId.toString(),
    nicknameOf(streamId) ?? "",
    stroopsToXlm(BigInt(receipt.amountStroops)),
    new Date(receipt.atMs).toISOString(),
    receipt.hash,
    explorerTxUrl(receipt.hash),
  ]);
}

/** A dated export filename: streampay-<kind>-YYYY-MM-DD.csv. */
export function exportFilename(kind: string, now: Date = new Date()): string {
  return `streampay-${kind}-${now.toISOString().slice(0, 10)}.csv`;
}

/**
 * Trigger a browser download of CSV text. A UTF-8 BOM is prepended so Excel
 * detects the encoding (addresses and future non-ASCII currency labels
 * survive). Kept tiny and separate so the mappers above stay pure and the
 * components stay testable without a real download.
 */
export function downloadCsv(filename: string, csv: string): void {
  const bom = String.fromCharCode(0xfeff);
  const blob = new Blob([bom, csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
