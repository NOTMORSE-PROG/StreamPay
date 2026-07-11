import { describe, expect, it } from "vitest";
import {
  AmountParseError,
  groupThousands,
  stroopsToXlm,
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

  it("handles negatives defensively", () => {
    expect(stroopsToXlm(-25_000_000n)).toBe("-2.5");
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
