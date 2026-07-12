import { describe, expect, it } from "vitest";
import type { Stream } from "./contract";
import {
  accruedAt,
  ratePerSecond,
  smoothedAccrued,
  withdrawableStroops,
} from "./accrual";

// A stream whose start is 0 so `now` in these tests reads as elapsed seconds
// directly, matching the contract's fixture cases (test.rs) which set the clock
// relative to the stream start.
function makeStream(overrides: Partial<Stream> = {}): Stream {
  return {
    id: 1n,
    employer: "GAWCHLI26MZCP4UISX7TSY4SOBRQOKYOANKEQKQWTX4KFFGUYN5LH6V4",
    worker: "GCQGDN634N7LNECZNWXUYHW2OFWNCQRG2CJHLBE4M375CNMXBLL2WKZN",
    token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    deposit: 600n,
    start: 0n,
    duration: 3_600n,
    withdrawn: 0n,
    cancelled: false,
    ...overrides,
  };
}

describe("accruedAt matches the contract's floor-formula fixtures (test.rs)", () => {
  // Identical cases to accrued_follows_the_floor_formula_fixtures: 600 over 3600.
  it("is 0 at elapsed 0, 300 at 1800, 600 at 3600, capped past the end", () => {
    const s = makeStream();
    expect(accruedAt(s, 0n)).toBe(0n);
    expect(accruedAt(s, 1_800n)).toBe(300n);
    expect(accruedAt(s, 3_600n)).toBe(600n);
    expect(accruedAt(s, 7_200n)).toBe(600n);
  });

  // accrued_floor_division_holds_back_dust_until_the_final_second: 100 over 60.
  it("holds back floor-division dust until the final second (100 over 60s)", () => {
    const s = makeStream({ deposit: 100n, duration: 60n });
    expect(accruedAt(s, 59n)).toBe(98n); // floor(59 * 100 / 60) = 98
    expect(accruedAt(s, 60n)).toBe(100n); // the last 2 dust units at vesting
  });

  // accrued_rate_floor_stays_zero_until_a_whole_unit_is_earned: 10 over 3600.
  it("stays 0 until a whole unit is earned (10 over 3600s)", () => {
    const s = makeStream({ deposit: 10n, duration: 3_600n });
    expect(accruedAt(s, 359n)).toBe(0n); // floor(359 * 10 / 3600) = 0
    expect(accruedAt(s, 360n)).toBe(1n); // floor(360 * 10 / 3600) = 1
  });

  // sc12_accrued_before_start_is_zero_not_underflow, client mirror: a query with
  // now before the start is 0, never an underflow.
  it("is 0 before the start, never an underflow", () => {
    const s = makeStream({ start: 1_000n });
    expect(accruedAt(s, 900n)).toBe(0n);
    expect(accruedAt(s, 1_000n)).toBe(0n);
  });
});

describe("smoothedAccrued (ledger-anchored display smoothing)", () => {
  // 600 over 3600s, start 0. At the anchor ledger second the smoothed value
  // equals the contract's accrued (same floor), then it ticks up smoothly.
  it("equals the contract accrued at zero local elapsed (no poll snap)", () => {
    const s = makeStream(); // 600 over 3600, start 0
    // anchor ledger second 1800 => accrued 300; elapsedMs 0 => exactly 300.
    expect(smoothedAccrued(s, 1_800n, 0n)).toBe(accruedAt(s, 1_800n));
    expect(smoothedAccrued(s, 1_800n, 0n)).toBe(300n);
  });

  it("ticks upward from the ledger anchor at the stream's rate", () => {
    const s = makeStream(); // 1/6 unit per second
    // From ledger second 1800 (=300), +6000 ms is +1 unit, +60000 ms is +10.
    expect(smoothedAccrued(s, 1_800n, 6_000n)).toBe(301n);
    expect(smoothedAccrued(s, 1_800n, 60_000n)).toBe(310n);
  });

  it("is monotonic non-decreasing in local elapsed", () => {
    const s = makeStream();
    let prev = smoothedAccrued(s, 1_800n, 0n);
    for (let ms = 100n; ms <= 12_000n; ms += 100n) {
      const next = smoothedAccrued(s, 1_800n, ms);
      expect(next).toBeGreaterThanOrEqual(prev);
      expect(next).toBeGreaterThanOrEqual(300n);
      prev = next;
    }
  });

  it("advancing the ledger anchor never steps the value backward", () => {
    // The poll-snap regression: a fresh chain read (later ledger second) must
    // continue the same curve, not drop below where the display already was.
    const s = makeStream();
    // Display had smoothed to ledger 1800 + 5900 ms of local drift.
    const beforePoll = smoothedAccrued(s, 1_800n, 5_900n);
    // A poll lands with ledger advanced to 1805 (5 s later) and ~0 local drift.
    const afterPoll = smoothedAccrued(s, 1_805n, 0n);
    expect(afterPoll).toBeGreaterThanOrEqual(beforePoll);
  });

  it("stops exactly at the deposit cap, however long the tab was left open", () => {
    const short = makeStream({ deposit: 600n, duration: 600n, start: 0n });
    // A full day of local elapsed past a 10-minute stream still caps at deposit.
    expect(smoothedAccrued(short, 600n, 86_400_000n)).toBe(600n);
    expect(smoothedAccrued(short, 300n, 86_400_000n)).toBe(600n);
  });

  it("is 0 before the stream start, never negative", () => {
    const s = makeStream({ start: 1_000n });
    expect(smoothedAccrued(s, 900n, 0n)).toBe(0n);
    expect(smoothedAccrued(s, 900n, 50_000n)).toBe(0n);
  });
});

describe("withdrawableStroops and ratePerSecond", () => {
  it("is chain accrued minus withdrawn, never negative", () => {
    const s = makeStream({ withdrawn: 100n });
    expect(withdrawableStroops(s, 300n)).toBe(200n);
    expect(withdrawableStroops(s, 100n)).toBe(0n);
    expect(withdrawableStroops(s, 50n)).toBe(0n); // clamped, never negative
  });

  it("is 0 for a cancelled stream (earned already paid at cancel)", () => {
    const s = makeStream({ cancelled: true, withdrawn: 250n });
    expect(withdrawableStroops(s, 250n)).toBe(0n);
  });

  it("floors the per-second rate", () => {
    expect(ratePerSecond(makeStream({ deposit: 600n, duration: 3_600n }))).toBe(
      0n,
    );
    expect(
      ratePerSecond(makeStream({ deposit: 100_000_000n, duration: 600n })),
    ).toBe(166_666n);
  });
});

// SC-15 (catalog): the UI ticking display never claims more than the on-chain
// accrued value at the moment a withdrawal is submitted (invariant I-7). The
// smoothed number visibly runs ahead of the last chain read between polls, but
// the amount offered for withdrawal is computed from the chain read, so a worker
// can never submit a withdraw for more than the contract has actually accrued.
describe("SC-15 / I-7: withdraw amount clamps to chain truth, not the display", () => {
  it("sc15_ui_display_never_claims_more_than_chain_accrued", () => {
    const stream = makeStream({
      deposit: 600n,
      duration: 3_600n,
      start: 0n,
      withdrawn: 0n,
    });
    // The last on-chain read: ledger second 1800 => accrued 300.
    const chainAccrued = accruedAt(stream, 1_800n);
    expect(chainAccrued).toBe(300n);
    // The display has smoothed 10 s past that read (local drift between polls).
    const displayed = smoothedAccrued(stream, 1_800n, 10_000n);
    expect(displayed).toBeGreaterThan(chainAccrued);

    // The withdrawable figure MUST come from the chain read, never the display.
    const offered = withdrawableStroops(stream, chainAccrued);
    expect(offered).toBe(chainAccrued); // withdrawn is 0 here
    expect(offered).toBeLessThan(displayed);
    // The core clamp: the offered amount never exceeds on-chain accrued.
    expect(offered).toBeLessThanOrEqual(chainAccrued);
  });

  it("holds the clamp with prior withdrawals", () => {
    const stream = makeStream({
      deposit: 600n,
      duration: 3_600n,
      withdrawn: 120n,
    });
    const chainAccrued = 300n;
    const offered = withdrawableStroops(stream, chainAccrued);
    // available = 300 - 120 = 180, and 180 + already-withdrawn 120 = 300 = accrued.
    expect(offered).toBe(180n);
    expect(offered + stream.withdrawn).toBeLessThanOrEqual(chainAccrued);
  });
});
