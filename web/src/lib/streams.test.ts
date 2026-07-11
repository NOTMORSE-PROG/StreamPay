import { beforeEach, describe, expect, it } from "vitest";
import type { Stream } from "./contract";
import {
  deriveLifecycleState,
  getNickname,
  progressPercent,
  setNickname,
  summarize,
  type StreamRow,
} from "./streams";

function makeStream(overrides: Partial<Stream> = {}): Stream {
  return {
    id: 1n,
    employer: "GAWCHLI26MZCP4UISX7TSY4SOBRQOKYOANKEQKQWTX4KFFGUYN5LH6V4",
    worker: "GCQGDN634N7LNECZNWXUYHW2OFWNCQRG2CJHLBE4M375CNMXBLL2WKZN",
    token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    deposit: 100_000_000n,
    start: 1_783_770_118n,
    duration: 600n,
    withdrawn: 0n,
    cancelled: false,
    ...overrides,
  };
}

describe("deriveLifecycleState", () => {
  it("is active while accrued is below the deposit", () => {
    expect(deriveLifecycleState(makeStream(), 40_000_000n)).toBe("active");
  });

  it("is completed when fully vested but not fully withdrawn", () => {
    const stream = makeStream({ withdrawn: 10_000_000n });
    expect(deriveLifecycleState(stream, 100_000_000n)).toBe("completed");
  });

  it("is drained when fully vested and fully withdrawn", () => {
    const stream = makeStream({ withdrawn: 100_000_000n });
    expect(deriveLifecycleState(stream, 100_000_000n)).toBe("drained");
  });

  it("is cancelled regardless of accrued when the stream is cancelled", () => {
    const stream = makeStream({ cancelled: true, withdrawn: 16_166_666n });
    expect(deriveLifecycleState(stream, 16_166_666n)).toBe("cancelled");
  });
});

describe("progressPercent", () => {
  it("reports integer vesting progress and caps at 100", () => {
    expect(progressPercent(makeStream(), 0n)).toBe(0);
    expect(progressPercent(makeStream(), 50_000_000n)).toBe(50);
    expect(progressPercent(makeStream(), 100_000_000n)).toBe(100);
    expect(progressPercent(makeStream(), 200_000_000n)).toBe(100);
  });
});

describe("summarize", () => {
  it("counts only active streams and sums their deposits", () => {
    const rows: StreamRow[] = [
      { stream: makeStream({ id: 1n }), accrued: 10n, state: "active" },
      {
        stream: makeStream({ id: 2n, deposit: 5_000_000n }),
        accrued: 5_000_000n,
        state: "drained",
      },
      {
        stream: makeStream({ id: 3n, deposit: 20_000_000n }),
        accrued: 1n,
        state: "active",
      },
    ];
    expect(summarize(rows)).toEqual({
      activeCount: 2,
      totalStreaming: 120_000_000n,
    });
  });

  it("is zero for an empty list", () => {
    expect(summarize([])).toEqual({ activeCount: 0, totalStreaming: 0n });
  });
});

describe("nickname storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves, reads, and clears a nickname keyed by stream id", () => {
    expect(getNickname(7n)).toBeNull();
    setNickname(7n, "Maria Santos");
    expect(getNickname(7n)).toBe("Maria Santos");
    setNickname(7n, "   ");
    expect(getNickname(7n)).toBeNull();
  });
});
