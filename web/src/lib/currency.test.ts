import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  formatInCurrency,
  getDisplayCurrency,
  isConverted,
  setDisplayCurrency,
} from "./currency";

describe("formatInCurrency", () => {
  const tenXlm = 100_000_000n; // 10 XLM in stroops

  it("shows XLM as the on-chain figure", () => {
    expect(formatInCurrency(tenXlm, "XLM")).toBe("10 XLM");
  });

  it("converts to an indicative USD figure (demo rate 0.11)", () => {
    // 10 XLM * 0.11 = $1.10
    expect(formatInCurrency(tenXlm, "USD")).toBe("$1.10");
  });

  it("converts to an indicative PHP figure (demo rate 0.11 * 58)", () => {
    // 10 XLM -> $1.10 -> 1.10 * 58 = ₱63.80
    expect(formatInCurrency(tenXlm, "PHP")).toBe("₱63.80");
  });

  it("marks only non-XLM currencies as converted", () => {
    expect(isConverted("XLM")).toBe(false);
    expect(isConverted("USD")).toBe(true);
    expect(isConverted("PHP")).toBe(true);
  });
});

describe("display-currency preference", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("defaults to XLM and round-trips a saved choice", () => {
    expect(getDisplayCurrency()).toBe("XLM");
    setDisplayCurrency("PHP");
    expect(getDisplayCurrency()).toBe("PHP");
  });

  it("ignores an unknown stored value", () => {
    localStorage.setItem("streampay:display-currency", "EUR");
    expect(getDisplayCurrency()).toBe("XLM");
  });
});
