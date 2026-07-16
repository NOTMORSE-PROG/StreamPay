import { describe, expect, it } from "vitest";
import {
  AmountParseError,
  groupThousands,
  stroopsToXlm,
  stroopsToXlmCompact,
  stroopsToXlmTicker,
  truncateAddress,
  xlmToStroops,
} from "./format";

describe("xlmToStroops", () => {
  it("converts whole and fractional tokens exactly", () => {
    expect(xlmToStroops("10")).toBe(100_000_000n);
    expect(xlmToStroops("2.5")).toBe(25_000_000n);
    expect(xlmToStroops("0")).toBe(0n);
    expect(xlmToStroops("0.0000001")).toBe(1n); // one stroop
    expect(xlmToStroops("0.1234567")).toBe(1_234_567n);
  });

  it("trims surrounding whitespace", () => {
    expect(xlmToStroops("  3.5  ")).toBe(35_000_000n);
  });

  it("rejects more than seven decimals (would lose a stroop)", () => {
    expect(() => xlmToStroops("0.00000001")).toThrow(AmountParseError);
  });

  it("rejects malformed, empty, and negative input", () => {
    for (const bad of ["", "abc", "-5", "1.2.3", "1e3", ".5", "5.", "  "]) {
      expect(() => xlmToStroops(bad)).toThrow(AmountParseError);
    }
  });
});

describe("stroopsToXlm", () => {
  it("round-trips with xlmToStroops and trims trailing zeros by default", () => {
    expect(stroopsToXlm(100_000_000n)).toBe("10");
    expect(stroopsToXlm(25_000_000n)).toBe("2.5");
    expect(stroopsToXlm(0n)).toBe("0");
    expect(stroopsToXlm(1n)).toBe("0.0000001");
  });

  it("matches the contract's exact accrual figures from T-008", () => {
    // The live drill read accrued = 8,666,666 stroops (T-008 evidence).
    expect(stroopsToXlm(8_666_666n)).toBe("0.8666666");
    expect(stroopsToXlm(11_166_666n)).toBe("1.1166666");
    expect(stroopsToXlm(83_833_334n)).toBe("8.3833334");
  });

  it("pads to a fixed width for a stable ticker and truncates (never rounds up)", () => {
    expect(stroopsToXlm(25_000_000n, { fractionDigits: 7 })).toBe("2.5000000");
    // Truncation, not rounding: a display can never claim more than on-chain (I-7).
    expect(stroopsToXlm(19n, { fractionDigits: 6 })).toBe("0.000001");
  });

  it("groups thousands for dashboard readouts", () => {
    expect(stroopsToXlm(12_345_678_900_000n, { group: true })).toBe(
      "1,234,567.89",
    );
  });

  it("caps decimals for summary cards and trims what remains", () => {
    // 4,444.4444444 XLM shown compactly: at most 2 decimals, truncated.
    expect(
      stroopsToXlm(44_444_444_444n, { group: true, maxFractionDigits: 2 }),
    ).toBe("4,444.44");
    // Whole values stay whole (no forced ".00"), and shorter fractions survive.
    expect(stroopsToXlm(100_000_000n, { maxFractionDigits: 2 })).toBe("10");
    expect(stroopsToXlm(25_000_000n, { maxFractionDigits: 2 })).toBe("2.5");
    // A sub-cap dust amount truncates to the whole part rather than rounding up.
    expect(stroopsToXlm(99_999n, { maxFractionDigits: 2 })).toBe("0");
  });

  it("handles negatives defensively", () => {
    expect(stroopsToXlm(-25_000_000n)).toBe("-2.5");
  });
});

describe("stroopsToXlmCompact", () => {
  it("shows at most 2 decimals, truncated and grouped", () => {
    expect(stroopsToXlmCompact(44_444_444_444n)).toBe("4,444.44");
    expect(stroopsToXlmCompact(94_333_333_333n)).toBe("9,433.33");
    expect(stroopsToXlmCompact(100_000_000n)).toBe("10");
    expect(stroopsToXlmCompact(25_000_000n)).toBe("2.5");
    expect(stroopsToXlmCompact(0n)).toBe("0");
  });

  it("never reads as empty while money exists: dust falls back to the exact figure", () => {
    expect(stroopsToXlmCompact(5n)).toBe("0.0000005");
    expect(stroopsToXlmCompact(99_999n)).toBe("0.0099999");
  });
});

describe("stroopsToXlmTicker", () => {
  it("keeps all 7 decimals while the balance is small (a slow stream still ticks)", () => {
    expect(stroopsToXlmTicker(1_666_666n)).toBe("0.1666666");
    expect(stroopsToXlmTicker(91_666_666n)).toBe("9.1666666");
  });

  it("trades fraction digits for whole digits so the hero stays one line wide", () => {
    // The T-018 rehearsal figure that used to wrap on a phone (T-055 bug).
    expect(stroopsToXlmTicker(94_333_333_333n)).toBe("9,433.3333");
    expect(stroopsToXlmTicker(943_333_333_333n)).toBe("94,333.333");
  });

  it("keeps the width stable within a magnitude band (fixed, zero-padded fraction)", () => {
    expect(stroopsToXlmTicker(10_000_000_000n)).toBe("1,000.0000");
    expect(stroopsToXlmTicker(19_999_999_999n)).toBe("1,999.9999");
  });

  it("never drops below two decimals on huge balances", () => {
    expect(stroopsToXlmTicker(10_000_000_000_000_000n)).toBe(
      "1,000,000,000.00",
    );
  });
});

// SC-17 (catalog): the compact summary-card display (maxFractionDigits) always
// truncates, never rounds up, so a card figure never claims more than the
// on-chain amount (invariant I-7), for every fraction length.
describe("SC-17 / I-7: compact card display never claims more than on-chain", () => {
  it("sc17_compact_summary_display_never_claims_more_than_chain", () => {
    // The worst case for rounding-up temptation: all-nines fractions.
    expect(stroopsToXlm(9_999_999n, { maxFractionDigits: 2 })).toBe("0.99");
    expect(stroopsToXlm(19_999_999n, { maxFractionDigits: 2 })).toBe("1.99");
    // Exhaustive sweep across two full truncation steps (0.01 XLM = 100,000
    // stroops): the displayed value, parsed back to stroops, is never above
    // the true amount and never a full step or more below it. Violations are
    // counted and asserted once so the sweep stays far under the test timeout.
    let violations = 0;
    for (let stroops = 0n; stroops < 200_000n; stroops += 1n) {
      const shown = stroopsToXlm(stroops, { maxFractionDigits: 2 });
      const backAsStroops = xlmToStroops(shown);
      if (backAsStroops > stroops || stroops - backAsStroops >= 100_000n) {
        violations += 1;
      }
    }
    expect(violations).toBe(0);
  });
});

describe("groupThousands", () => {
  it("inserts separators only where needed", () => {
    expect(groupThousands("1")).toBe("1");
    expect(groupThousands("1000")).toBe("1,000");
    expect(groupThousands("1000000")).toBe("1,000,000");
  });
});

describe("truncateAddress", () => {
  it("shows the ends of a long address", () => {
    expect(truncateAddress("GABCDEFGHIJKLMNOP")).toBe("GABC...MNOP");
  });

  it("leaves short strings intact", () => {
    expect(truncateAddress("GABC")).toBe("GABC");
  });
});
