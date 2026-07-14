// Pure helpers for the employer stream list: lifecycle derivation, progress, the
// dashboard summary, and nickname storage. All derived from on-chain state and its
// accrued figure (decision 12: lifecycle is never stored client-side). Unit-tested
// in streams.test.ts.

import type { Stream } from "./contract";

export type LifecycleState = "active" | "completed" | "drained" | "cancelled";

export interface StreamRow {
  stream: Stream;
  accrued: bigint;
  state: LifecycleState;
}

/**
 * Derive the lifecycle state from the stream and its current accrued figure alone.
 * accrued caps at the deposit in the contract, so "fully vested" needs no client
 * clock: cancelled wins; then a fully vested stream is Drained if everything was
 * withdrawn else Completed; otherwise it is still Active.
 */
export function deriveLifecycleState(
  stream: Stream,
  accrued: bigint,
): LifecycleState {
  if (stream.cancelled) {
    return "cancelled";
  }
  if (accrued >= stream.deposit) {
    return stream.withdrawn >= stream.deposit ? "drained" : "completed";
  }
  return "active";
}

/** Integer vesting progress percent (0..100) for a progress bar. */
export function progressPercent(stream: Stream, accrued: bigint): number {
  if (stream.deposit <= 0n) {
    return 0;
  }
  const capped = accrued > stream.deposit ? stream.deposit : accrued;
  return Number((capped * 100n) / stream.deposit);
}

export interface FairSplit {
  /** Everything the worker earned to date (kept by the worker at cancel). */
  workerAmount: bigint;
  /** The remainder of the deposit refunded to the employer. */
  employerRefund: bigint;
}

/**
 * The two legs of a cancel (contract lib.rs::cancel): the worker keeps everything
 * earned, the employer is refunded the rest, and the two always sum to the
 * deposit. `earned` is clamped to [0, deposit] so the split is well-formed for any
 * input. Used for BOTH the pre-cancel estimate (earned = current accrued, labeled
 * "as of now") and the executed figures read back from post-cancel state (earned =
 * the frozen withdrawn), which is on-chain truth, not a local recomputation.
 */
export function fairSplit(deposit: bigint, earned: bigint): FairSplit {
  const capped = earned < 0n ? 0n : earned > deposit ? deposit : earned;
  return { workerAmount: capped, employerRefund: deposit - capped };
}

export interface StreamsSummary {
  activeCount: number;
  totalStreaming: bigint;
  /** Sum of every stream's deposit, active or not (the payroll ever funded). */
  totalDeposited: bigint;
}

/**
 * Dashboard header figures: how many streams are still active, the total deposit
 * currently in flight across active streams, and the total ever deposited across
 * every stream (for the "total deposited" stat tile).
 */
export function summarize(rows: StreamRow[]): StreamsSummary {
  let activeCount = 0;
  let totalStreaming = 0n;
  let totalDeposited = 0n;
  for (const row of rows) {
    totalDeposited += row.stream.deposit;
    if (row.state === "active") {
      activeCount += 1;
      totalStreaming += row.stream.deposit;
    }
  }
  return { activeCount, totalStreaming, totalDeposited };
}

const LABELS: Record<LifecycleState, string> = {
  active: "Active",
  completed: "Completed",
  drained: "Drained",
  cancelled: "Cancelled",
};

/** Human label for a lifecycle state badge. */
export function lifecycleLabel(state: LifecycleState): string {
  return LABELS[state];
}

export type StatusFilter = "all" | "active" | "completed" | "cancelled";

/**
 * Whether a stream's lifecycle state matches a dashboard filter tab. "completed"
 * groups the two finished-vesting states (completed and drained) so the tab count
 * matches what an employer means by "done".
 */
export function matchesStatusFilter(
  state: LifecycleState,
  filter: StatusFilter,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "active":
      return state === "active";
    case "completed":
      return state === "completed" || state === "drained";
    case "cancelled":
      return state === "cancelled";
  }
}

/**
 * Case-insensitive search over a stream's id, its saved nickname, and its worker
 * address, for the dashboard search box. An empty query matches everything.
 */
export function matchesSearch(
  row: StreamRow,
  query: string,
  nickname: string | null,
): boolean {
  const q = query.trim().toLowerCase();
  if (q === "") {
    return true;
  }
  const haystack = [
    `#${row.stream.id.toString()}`,
    row.stream.id.toString(),
    nickname ?? "",
    row.stream.worker,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

const NICKNAME_PREFIX = "streampay:nick:";

/** The saved nickname for a stream id, or null if none. */
export function getNickname(streamId: bigint): string | null {
  return localStorage.getItem(NICKNAME_PREFIX + streamId.toString());
}

/** Save (or clear, when empty) a stream's nickname. */
export function setNickname(streamId: bigint, nickname: string): void {
  const key = NICKNAME_PREFIX + streamId.toString();
  const trimmed = nickname.trim();
  if (trimmed === "") {
    localStorage.removeItem(key);
  } else {
    localStorage.setItem(key, trimmed);
  }
}
