// The client mirror of the contract's per-second accrual, kept bit-for-bit equal
// to contracts/streampay/src/lib.rs::accrued_amount. The worker view (T-013)
// smooths the big ticking number between chain reads with this math, so it must
// never diverge from on-chain truth: its fixtures are the same hand-computed
// cases the contract asserts (contracts/streampay/src/test.rs). Integer stroops
// only, floor division, no float ever touches a money value (I-5). I-7 lives
// here too: the amount a worker may withdraw is clamped to the last on-chain
// accrued read, never to the smoothed display.

import type { Stream } from "./contract";

/**
 * Earned-so-far in stroops at `nowSeconds` (unix), the exact contract formula:
 * floor(min(max(0, now - start), duration) * deposit / duration). Because the
 * elapsed term is clamped to `duration`, the result is inherently capped at the
 * deposit (I-2). Pure bigint; mirrors lib.rs::accrued_amount. Cancelled streams
 * are NOT smoothed with this: the chain read returns the frozen final earned
 * (contract accrued() returns stream.withdrawn once cancelled), so the caller
 * uses that value directly.
 */
export function accruedAt(stream: Stream, nowSeconds: bigint): bigint {
  if (stream.duration <= 0n) {
    return 0n; // create_stream forbids a zero duration; defensive only.
  }
  const rawElapsed = nowSeconds > stream.start ? nowSeconds - stream.start : 0n;
  const elapsed = rawElapsed > stream.duration ? stream.duration : rawElapsed;
  return (stream.deposit * elapsed) / stream.duration;
}

/**
 * The on-screen figure between chain reads, at millisecond resolution so the hero
 * number ticks smoothly: floor(deposit * clamp(elapsedSinceStartMs) / (duration *
 * 1000)) where elapsedSinceStartMs runs from the LEDGER time of the last chain
 * read plus the wall-clock `elapsedMs` since it landed.
 *
 * Anchoring to ledger time (not the wall clock at fetch) is deliberate (T-013):
 * the accrued read and its ledger timestamp are a consistent pair, so a poll
 * refines the same curve the display is already on instead of snapping it
 * backward by the fetch latency. At elapsedMs = 0 this returns exactly the
 * contract's `accrued` (same floor), it can never claim more than
 * anchor + elapsed*rate (the honest rule, ENGINEERING.md decision 3), and the
 * clamp to `duration` stops the tick exactly at the deposit cap. The 2.5 min
 * dev-clock offset seen in T-008 is irrelevant here because only the wall-clock
 * DELTA since the anchor is used, never an absolute client time. Pure bigint.
 */
export function smoothedAccrued(
  stream: Stream,
  anchorLedgerSeconds: bigint,
  elapsedMs: bigint,
): bigint {
  if (stream.duration <= 0n) {
    return 0n;
  }
  const sinceStartMs =
    (anchorLedgerSeconds - stream.start) * 1000n +
    (elapsedMs > 0n ? elapsedMs : 0n);
  const durationMs = stream.duration * 1000n;
  const clampedMs =
    sinceStartMs < 0n
      ? 0n
      : sinceStartMs > durationMs
        ? durationMs
        : sinceStartMs;
  return (stream.deposit * clampedMs) / durationMs;
}

/**
 * The amount the worker may withdraw right now, clamped to on-chain truth (I-7):
 * the LAST chain-read accrued minus what has already been withdrawn, never the
 * smoothed display. A cancelled stream exposes nothing (its earned wages were
 * already paid out by the cancel). Never negative.
 */
export function withdrawableStroops(
  stream: Stream,
  chainAccrued: bigint,
): bigint {
  if (stream.cancelled) {
    return 0n;
  }
  const available = chainAccrued - stream.withdrawn;
  return available > 0n ? available : 0n;
}

/**
 * The stream's nominal per-second rate in stroops (floor), for the "per second"
 * label under the balance. This is the display rate; the contract's own accrual
 * is the floor formula above, not a running multiply, so the two agree at every
 * whole second and the label never overstates a second's pay.
 */
export function ratePerSecond(stream: Stream): bigint {
  if (stream.duration <= 0n) {
    return 0n;
  }
  return stream.deposit / stream.duration;
}
