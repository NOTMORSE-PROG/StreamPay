import { describe, expect, it } from "vitest";
import {
  ACTIVITY_EXPORT_HEADERS,
  activityExportRows,
  csvField,
  EMPLOYER_EXPORT_HEADERS,
  employerExportRows,
  exportFilename,
  toCsv,
} from "./csv";
import type { Stream } from "./contract";
import type { StreamRow } from "./streams";
import type { StreamReceipt } from "./withdraw";

function makeStream(overrides: Partial<Stream> = {}): Stream {
  return {
    id: 7n,
    employer: "GAWCHLI26MZCP4UISX7TSY4SOBRQOKYOANKEQKQWTX4KFFGUYN5LH6V4",
    worker: "GCQGDN634N7LNECZNWXUYHW2OFWNCQRG2CJHLBE4M375CNMXBLL2WKZN",
    token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    deposit: 100_000_000n,
    start: 1_752_300_000n,
    duration: 600n,
    withdrawn: 25_000_000n,
    cancelled: false,
    ...overrides,
  };
}

describe("csvField", () => {
  it("passes plain fields through untouched", () => {
    expect(csvField("Stream 7")).toBe("Stream 7");
  });

  it("quotes fields containing commas, quotes, and newlines", () => {
    expect(csvField("a,b")).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("defuses formula injection for every dangerous leading character", () => {
    expect(csvField("=CMD()")).toBe("'=CMD()");
    expect(csvField("+1")).toBe("'+1");
    expect(csvField("-1")).toBe("'-1");
    expect(csvField("@sum")).toBe("'@sum");
  });

  it("defuses and quotes when a field needs both", () => {
    expect(csvField("=1,2")).toBe('"\'=1,2"');
  });
});

describe("toCsv", () => {
  it("joins with CRLF and ends with a final newline", () => {
    expect(toCsv(["a", "b"], [["1", "2"]])).toBe("a,b\r\n1,2\r\n");
  });

  it("yields a header-only file for zero rows", () => {
    expect(toCsv(["a", "b"], [])).toBe("a,b\r\n");
  });
});

describe("employerExportRows", () => {
  it("maps a row to the documented header order with exact chain figures", () => {
    const row: StreamRow = {
      stream: makeStream(),
      accrued: 50_000_000n,
      state: "active",
    };
    const [cells] = employerExportRows([row], () => "July wages");
    expect(EMPLOYER_EXPORT_HEADERS).toEqual([
      "stream_id",
      "nickname",
      "worker_address",
      "status",
      "deposit_xlm",
      "accrued_xlm",
      "withdrawn_xlm",
      "start_utc",
      "duration_seconds",
      "rate_xlm_per_second",
    ]);
    expect(cells).toEqual([
      "7",
      "July wages",
      "GCQGDN634N7LNECZNWXUYHW2OFWNCQRG2CJHLBE4M375CNMXBLL2WKZN",
      "Active",
      "10",
      "5",
      "2.5",
      new Date(1_752_300_000 * 1000).toISOString(),
      "600",
      // 100,000,000 / 600 = 166,666 stroops (floor), shown at 7 decimals like
      // the create-form preview.
      "0.0166666",
    ]);
  });

  it("uses an empty nickname when none is saved", () => {
    const row: StreamRow = {
      stream: makeStream(),
      accrued: 0n,
      state: "active",
    };
    const [cells] = employerExportRows([row], () => null);
    expect(cells?.[1]).toBe("");
  });
});

describe("activityExportRows", () => {
  it("maps a receipt to the documented header order", () => {
    const receipt: StreamReceipt = {
      streamId: 7n,
      receipt: {
        amountStroops: "25000000",
        hash: "abc123",
        atMs: 1_700_000_000_000,
      },
    };
    const [cells] = activityExportRows([receipt], () => null);
    expect(ACTIVITY_EXPORT_HEADERS).toEqual([
      "stream_id",
      "nickname",
      "amount_xlm",
      "withdrawn_at_utc",
      "transaction_hash",
      "explorer_url",
    ]);
    expect(cells).toEqual([
      "7",
      "",
      "2.5",
      new Date(1_700_000_000_000).toISOString(),
      "abc123",
      "https://stellar.expert/explorer/testnet/tx/abc123",
    ]);
  });
});

describe("exportFilename", () => {
  it("carries the kind and the ISO date", () => {
    expect(exportFilename("streams", new Date("2026-07-12T20:00:00Z"))).toBe(
      "streampay-streams-2026-07-12.csv",
    );
  });
});
