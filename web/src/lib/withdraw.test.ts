import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addReceipt,
  getAllReceipts,
  getReceipts,
  resolveWithdrawAmount,
  type Receipt,
} from "./withdraw";

describe("resolveWithdrawAmount (I-7 clamped)", () => {
  const available = 100_000_000n; // 10 XLM in stroops

  it("empty input withdraws everything available", () => {
    expect(resolveWithdrawAmount("", available)).toEqual({
      amount: available,
      error: null,
    });
    expect(resolveWithdrawAmount("   ", available)).toEqual({
      amount: available,
      error: null,
    });
  });

  it("parses a partial amount in whole XLM to stroops", () => {
    expect(resolveWithdrawAmount("2.5", available)).toEqual({
      amount: 25_000_000n,
      error: null,
    });
  });

  it("accepts exactly the available amount", () => {
    expect(resolveWithdrawAmount("10", available)).toEqual({
      amount: 100_000_000n,
      error: null,
    });
  });

  it("rejects more than available (the I-7 clamp)", () => {
    const result = resolveWithdrawAmount("10.0000001", available);
    expect(result.amount).toBeNull();
    expect(result.error).toMatch(/more than you have earned/i);
  });

  it("rejects zero, negative, and malformed input", () => {
    expect(resolveWithdrawAmount("0", available).amount).toBeNull();
    expect(resolveWithdrawAmount("-1", available).amount).toBeNull();
    expect(resolveWithdrawAmount("abc", available).amount).toBeNull();
    expect(resolveWithdrawAmount("1.234567890", available).amount).toBeNull();
  });

  it("reports nothing-available when available is zero", () => {
    const result = resolveWithdrawAmount("", 0n);
    expect(result.amount).toBeNull();
    expect(result.error).toMatch(/nothing available/i);
  });
});

describe("receipt trail", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  const receipt = (hash: string, atMs: number): Receipt => ({
    amountStroops: "25000000",
    hash,
    atMs,
  });

  it("returns [] for a stream with no receipts", () => {
    expect(getReceipts(6n)).toEqual([]);
  });

  it("prepends new receipts (newest first) and persists them per stream", () => {
    addReceipt(6n, receipt("hashA", 1000));
    const list = addReceipt(6n, receipt("hashB", 2000));
    expect(list.map((r) => r.hash)).toEqual(["hashB", "hashA"]);
    // Persisted and reloadable.
    expect(getReceipts(6n).map((r) => r.hash)).toEqual(["hashB", "hashA"]);
    // Scoped per stream id.
    expect(getReceipts(7n)).toEqual([]);
  });

  it("survives corrupt stored data by returning []", () => {
    localStorage.setItem("streampay:receipts:6", "{not json");
    expect(getReceipts(6n)).toEqual([]);
  });

  it("drops malformed rows on read", () => {
    localStorage.setItem(
      "streampay:receipts:6",
      JSON.stringify([
        { hash: "ok", amountStroops: "1", atMs: 1 },
        { bad: true },
      ]),
    );
    const list = getReceipts(6n);
    expect(list).toHaveLength(1);
    expect(list[0].hash).toBe("ok");
  });
});

describe("getAllReceipts (across streams, newest first)", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  const receipt = (hash: string, atMs: number): Receipt => ({
    amountStroops: "25000000",
    hash,
    atMs,
  });

  it("returns [] when there are no receipts", () => {
    expect(getAllReceipts()).toEqual([]);
  });

  it("merges receipts from every stream, newest first", () => {
    addReceipt(6n, receipt("old", 1000));
    addReceipt(7n, receipt("newest", 3000));
    addReceipt(6n, receipt("middle", 2000));
    const all = getAllReceipts();
    expect(all.map((r) => r.receipt.hash)).toEqual(["newest", "middle", "old"]);
    // Each row carries the stream it came from.
    expect(all[0].streamId).toBe(7n);
    expect(all[1].streamId).toBe(6n);
  });

  it("ignores unrelated and corrupt keys", () => {
    addReceipt(6n, receipt("ok", 1000));
    localStorage.setItem("streampay:nick:6", "Cafe shift");
    localStorage.setItem("streampay:receipts:notanumber", "[]");
    localStorage.setItem("streampay:receipts:8", "{corrupt");
    const all = getAllReceipts();
    expect(all).toHaveLength(1);
    expect(all[0].receipt.hash).toBe("ok");
  });
});
