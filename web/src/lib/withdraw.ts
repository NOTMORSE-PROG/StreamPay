// Withdraw UI helpers: the amount resolver (pure, I-7 clamped) and the browser-
// local receipt trail. Kept out of the component so the money-input logic is unit
// tested. The receipt list is the worker's verifiable "not a black box" history
// (RESEARCH.md comparison row): every row carries a transaction hash that opens on
// the public explorer.

import { AmountParseError, xlmToStroops } from "./format";

export interface WithdrawAmountResult {
  /** The stroops to withdraw, or null when the input is not usable. */
  amount: bigint | null;
  /** A user-facing reason when amount is null; null when amount is valid. */
  error: string | null;
}

/**
 * Resolve the requested withdraw amount in stroops from the user's text, clamped
 * to the on-chain `available` figure (I-7: available is the last chain read minus
 * withdrawn, never the smoothed display). Empty input means "withdraw everything
 * available" (the fastest demo path). Rejects zero, negative, malformed, and
 * over-available amounts with a plain message.
 */
export function resolveWithdrawAmount(
  input: string,
  available: bigint,
): WithdrawAmountResult {
  if (available <= 0n) {
    return { amount: null, error: "Nothing available to withdraw yet." };
  }
  const trimmed = input.trim();
  if (trimmed === "") {
    return { amount: available, error: null };
  }
  let stroops: bigint;
  try {
    stroops = xlmToStroops(trimmed);
  } catch (error) {
    if (error instanceof AmountParseError) {
      return { amount: null, error: "Enter a valid amount, up to 7 decimals." };
    }
    throw error;
  }
  if (stroops <= 0n) {
    return { amount: null, error: "Enter an amount greater than zero." };
  }
  if (stroops > available) {
    return { amount: null, error: "That is more than you have earned so far." };
  }
  return { amount: stroops, error: null };
}

export interface Receipt {
  /** Amount withdrawn, in stroops, as a string (bigint is not JSON-native). */
  amountStroops: string;
  /** Transaction hash, for the explorer receipt link. */
  hash: string;
  /** Local timestamp (ms) the receipt was recorded. */
  atMs: number;
}

const RECEIPT_PREFIX = "streampay:receipts:";

/** The saved receipts for a stream, newest first; [] on none or corrupt data. */
export function getReceipts(streamId: bigint): Receipt[] {
  try {
    const raw = localStorage.getItem(RECEIPT_PREFIX + streamId.toString());
    if (raw === null) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is Receipt =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as Receipt).amountStroops === "string" &&
        typeof (item as Receipt).hash === "string" &&
        typeof (item as Receipt).atMs === "number",
    );
  } catch {
    return [];
  }
}

export interface StreamReceipt {
  /** The stream the receipt belongs to. */
  streamId: bigint;
  receipt: Receipt;
}

/**
 * Every withdrawal receipt across all of this browser's streams, newest first,
 * for the worker's Activity tab. Scans the `streampay:receipts:` keys, reuses the
 * per-stream parser (so corrupt entries are dropped, not thrown), and sorts by
 * timestamp descending.
 */
export function getAllReceipts(): StreamReceipt[] {
  const all: StreamReceipt[] = [];
  let keys: string[];
  try {
    keys = Object.keys(localStorage);
  } catch {
    return [];
  }
  for (const key of keys) {
    if (!key.startsWith(RECEIPT_PREFIX)) {
      continue;
    }
    const idText = key.slice(RECEIPT_PREFIX.length);
    let streamId: bigint;
    try {
      streamId = BigInt(idText);
    } catch {
      continue; // a key we did not write; skip it
    }
    for (const receipt of getReceipts(streamId)) {
      all.push({ streamId, receipt });
    }
  }
  all.sort((a, b) => b.receipt.atMs - a.receipt.atMs);
  return all;
}

/** Prepend a receipt for a stream and persist it; returns the updated list. */
export function addReceipt(streamId: bigint, receipt: Receipt): Receipt[] {
  const next = [receipt, ...getReceipts(streamId)];
  try {
    localStorage.setItem(
      RECEIPT_PREFIX + streamId.toString(),
      JSON.stringify(next),
    );
  } catch {
    // Persistence failed (private mode); the receipt still shows for this
    // session via the returned list.
  }
  return next;
}
