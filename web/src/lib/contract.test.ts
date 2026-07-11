import { describe, expect, it } from "vitest";
import { StrKey } from "@stellar/stellar-sdk";
import { decodeStream, SIMULATION_SOURCE, type Stream } from "./contract";

describe("SIMULATION_SOURCE", () => {
  it("is a valid ed25519 strkey (else every read throws in the SDK Account ctor)", () => {
    // Regression guard: a wrong checksum tail here was caught by the T-011 live
    // probe; the SDK's Account constructor rejects an invalid strkey, which would
    // break getStream/accrued/streamsBy*/getTokenBalance at runtime.
    expect(StrKey.isValidEd25519PublicKey(SIMULATION_SOURCE)).toBe(true);
  });
});

// Known-value fixture for the read-wrapper's decode logic (TESTING.md section 2).
// The object below is exactly the shape @stellar/stellar-sdk's scValToNative
// produces for the contract's `Stream` struct: addresses as strkeys, i128/u64 as
// bigint, bool as boolean. The full RPC path is proven live on testnet in T-012.
describe("decodeStream", () => {
  const raw = {
    employer: "GAWCHLI2XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    worker: "GCQGDN63XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    deposit: 100_000_000n,
    start: 1_783_770_118n,
    duration: 600n,
    withdrawn: 5_000_000n,
    cancelled: false,
  };

  it("maps every field to the typed Stream and attaches the id", () => {
    const stream: Stream = decodeStream(1n, raw);
    expect(stream.id).toBe(1n);
    expect(stream.employer).toBe(raw.employer);
    expect(stream.worker).toBe(raw.worker);
    expect(stream.token).toBe(raw.token);
    expect(stream.deposit).toBe(100_000_000n);
    expect(stream.start).toBe(1_783_770_118n);
    expect(stream.duration).toBe(600n);
    expect(stream.withdrawn).toBe(5_000_000n);
    expect(stream.cancelled).toBe(false);
  });

  it("preserves a cancelled flag", () => {
    const stream = decodeStream(2n, { ...raw, cancelled: true });
    expect(stream.cancelled).toBe(true);
  });
});
