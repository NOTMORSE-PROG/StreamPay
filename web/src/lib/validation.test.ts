import { describe, expect, it } from "vitest";
import { perSecondStroops, validateCreateStreamInputs } from "./validation";

// Real testnet demo accounts (streampay-dev / streampay-worker). StrKey checks the
// checksum, so these must be genuine keys, not placeholders.
const EMPLOYER = "GAWCHLI26MZCP4UISX7TSY4SOBRQOKYOANKEQKQWTX4KFFGUYN5LH6V4";
const WORKER = "GCQGDN634N7LNECZNWXUYHW2OFWNCQRG2CJHLBE4M375CNMXBLL2WKZN";

describe("validateCreateStreamInputs", () => {
  const base = {
    workerAddress: WORKER,
    amountText: "100",
    durationSeconds: 600,
    employerAddress: EMPLOYER,
  };

  it("rejects a malformed worker address", () => {
    const result = validateCreateStreamInputs({
      ...base,
      workerAddress: "not-an-address",
    });
    expect(result).toMatchObject({ ok: false, field: "worker" });
  });

  it("rejects the worker being the connected employer", () => {
    const result = validateCreateStreamInputs({
      ...base,
      workerAddress: EMPLOYER,
      employerAddress: EMPLOYER,
    });
    expect(result).toMatchObject({ ok: false, field: "worker" });
  });

  it("rejects a zero, negative, or malformed amount", () => {
    for (const amountText of ["0", "-5", "abc", ""]) {
      expect(validateCreateStreamInputs({ ...base, amountText })).toMatchObject(
        { ok: false, field: "amount" },
      );
    }
  });

  it("rejects a non-positive duration", () => {
    expect(
      validateCreateStreamInputs({ ...base, durationSeconds: 0 }),
    ).toMatchObject({ ok: false, field: "duration" });
  });

  it("accepts valid inputs and returns exact stroops and duration", () => {
    const result = validateCreateStreamInputs(base);
    expect(result).toEqual({
      ok: true,
      deposit: 1_000_000_000n,
      durationSeconds: 600n,
    });
  });
});

describe("perSecondStroops matches the contract floor math", () => {
  it("equals accrued after one second for T-008's live values", () => {
    // T-008 streamed 100,000,000 stroops over 600 s. Contract accrued at 1 s is
    // floor(1 * 100,000,000 / 600) = 166,666; the rate preview must match.
    expect(perSecondStroops(100_000_000n, 600n)).toBe(166_666n);
  });

  it("floors sub-unit rates to zero honestly", () => {
    // 100 stroops over 600 s is 0 stroops/second by floor (the contract accrues
    // nothing until a whole unit is earned; SC of the same shape).
    expect(perSecondStroops(100n, 600n)).toBe(0n);
  });
});
