import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { addReceipt } from "../../lib/withdraw";

// Stub the download helper so clicking Export CSV is observable without a
// real blob download (jsdom has no URL.createObjectURL).
const downloadCsvMock = vi.hoisted(() => vi.fn());
vi.mock("../../lib/csv", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/csv")>()),
  downloadCsv: downloadCsvMock,
}));

import { Activity } from "./Activity";

describe("Activity", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });
  afterEach(() => localStorage.clear());

  it("shows an empty state when there are no withdrawals", () => {
    render(<Activity />);
    expect(screen.getByText(/No cash-outs yet/)).toBeInTheDocument();
  });

  it("hides the export button when there is nothing to export", () => {
    render(<Activity />);
    expect(
      screen.queryByRole("button", { name: "Export CSV" }),
    ).not.toBeInTheDocument();
  });

  it("exports the receipt trail as CSV on click", () => {
    addReceipt(6n, {
      amountStroops: "25000000",
      hash: "abc123",
      atMs: 1_700_000_000_000,
    });
    render(<Activity />);
    screen.getByRole("button", { name: "Export CSV" }).click();
    expect(downloadCsvMock).toHaveBeenCalledTimes(1);
    const [filename, csv] = downloadCsvMock.mock.calls[0] as [string, string];
    expect(filename).toMatch(/^streampay-activity-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(csv).toContain(
      "stream_id,nickname,amount_xlm,withdrawn_at_utc,transaction_hash,explorer_url",
    );
    expect(csv).toContain(
      "6,,2.5,2023-11-14T22:13:20.000Z,abc123,https://stellar.expert/explorer/testnet/tx/abc123",
    );
  });

  it("lists receipts with amounts and explorer links", () => {
    addReceipt(6n, {
      amountStroops: "25000000",
      hash: "abc123",
      atMs: Date.now(),
    });
    render(<Activity />);
    expect(screen.getByText("2.5 XLM")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Receipt" });
    expect(link).toHaveAttribute(
      "href",
      "https://stellar.expert/explorer/testnet/tx/abc123",
    );
  });
});
