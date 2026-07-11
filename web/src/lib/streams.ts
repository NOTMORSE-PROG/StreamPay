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

export interface StreamsSummary {
  activeCount: number;
  totalStreaming: bigint;
}

/**
 * Dashboard header figures: how many streams are still active and the total
 * deposit currently in flight across them.
 */
export function summarize(rows: StreamRow[]): StreamsSummary {
  let activeCount = 0;
  let totalStreaming = 0n;
  for (const row of rows) {
    if (row.state === "active") {
      activeCount += 1;
      totalStreaming += row.stream.deposit;
    }
  }
  return { activeCount, totalStreaming };
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
