import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CancelDialog } from "./CancelDialog";
import type { Stream } from "../lib/contract";
import { cancelStream, getStream } from "../lib/contract";
import { SignError } from "../lib/wallet";

// Mock the chain and wallet boundaries, keeping the real error classes so the
// dialog's instanceof checks behave. The dialog is the unit under test.
vi.mock("../lib/contract", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/contract")>();
  return { ...actual, cancelStream: vi.fn(), getStream: vi.fn() };
});
vi.mock("../lib/wallet", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/wallet")>();
  return { ...actual, signWithFreighter: vi.fn() };
});

const cancelStreamMock = cancelStream as unknown as Mock;
const getStreamMock = getStream as unknown as Mock;

function makeStream(overrides: Partial<Stream> = {}): Stream {
  return {
    id: 6n,
    employer: "GAWCHLI26MZCP4UISX7TSY4SOBRQOKYOANKEQKQWTX4KFFGUYN5LH6V4",
    worker: "GCQGDN634N7LNECZNWXUYHW2OFWNCQRG2CJHLBE4M375CNMXBLL2WKZN",
    token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    deposit: 300_000_000n, // 30 XLM
    start: 0n,
    duration: 3_600n,
    withdrawn: 0n,
    cancelled: false,
    ...overrides,
  };
}

describe("CancelDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the pre-cancel estimate split (earned vs remainder)", () => {
    render(
      <CancelDialog
        stream={makeStream()}
        accrued={90_000_000n} // 9 XLM earned so far
        employer="GAWCHLI26MZCP4UISX7TSY4SOBRQOKYOANKEQKQWTX4KFFGUYN5LH6V4"
        onCancelled={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("Stop paying this worker?")).toBeInTheDocument();
    // Worker keeps 9, employer refunded 21.
    expect(screen.getByText("9 XLM")).toBeInTheDocument();
    expect(screen.getByText("21 XLM")).toBeInTheDocument();
  });

  it("confirms, then shows the EXECUTED split read from post-cancel state", async () => {
    cancelStreamMock.mockResolvedValue("txhash123");
    // Post-cancel state: withdrawn frozen at the earned amount (10 XLM).
    getStreamMock.mockResolvedValue(
      makeStream({ cancelled: true, withdrawn: 100_000_000n }),
    );
    const onCancelled = vi.fn();

    render(
      <CancelDialog
        stream={makeStream()}
        accrued={90_000_000n}
        employer="GAWCHLI26MZCP4UISX7TSY4SOBRQOKYOANKEQKQWTX4KFFGUYN5LH6V4"
        onCancelled={onCancelled}
        onClose={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Stop paying" }));

    await waitFor(() =>
      expect(screen.getByText("Payments stopped")).toBeInTheDocument(),
    );
    // Executed: worker kept 10 XLM, refunded 20 XLM (from post-cancel state).
    expect(screen.getByText("10 XLM")).toBeInTheDocument();
    expect(screen.getByText("20 XLM")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /receipt/i })).toHaveAttribute(
      "href",
      expect.stringContaining("txhash123"),
    );
    expect(onCancelled).toHaveBeenCalled();
  });

  it("keeps the stream untouched and dismissible when the signature is declined", async () => {
    // A declined Freighter signature surfaces as a SignError out of cancelStream.
    cancelStreamMock.mockRejectedValue(new SignError("declined"));

    render(
      <CancelDialog
        stream={makeStream()}
        accrued={90_000_000n}
        employer="GAWCHLI26MZCP4UISX7TSY4SOBRQOKYOANKEQKQWTX4KFFGUYN5LH6V4"
        onCancelled={() => {}}
        onClose={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Stop paying" }));

    await waitFor(() =>
      expect(screen.getByText(/approval declined/i)).toBeInTheDocument(),
    );
    // Still on the confirm screen (dismissible), and no post-cancel read ran.
    expect(screen.getByText("Stop paying this worker?")).toBeInTheDocument();
    expect(getStreamMock).not.toHaveBeenCalled();
  });
});
