import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { WithdrawPanel } from "./WithdrawPanel";
import { withdraw } from "../lib/contract";
import type { Stream } from "../lib/contract";
import type { DemoWallet } from "../lib/demoWallet";

// The withdraw path now routes through a confirm modal. Mock the chain boundary
// and assert the signature only fires after the worker confirms.
vi.mock("../lib/contract", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/contract")>();
  return { ...actual, withdraw: vi.fn() };
});

const withdrawMock = withdraw as unknown as Mock;

const WORKER = "GCQGDN634N7LNECZNWXUYHW2OFWNCQRG2CJHLBE4M375CNMXBLL2WKZN";

function makeStream(): Stream {
  return {
    id: 6n,
    employer: "GAWCHLI26MZCP4UISX7TSY4SOBRQOKYOANKEQKQWTX4KFFGUYN5LH6V4",
    worker: WORKER,
    token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    deposit: 100_000_000n,
    start: 0n,
    duration: 600n,
    withdrawn: 0n,
    cancelled: false,
  };
}

const wallet: DemoWallet = {
  publicKey: WORKER,
  persisted: true,
  signTransactionXdr: vi.fn((xdr: string) => xdr),
};

function renderPanel() {
  const onWithdrawn = vi.fn();
  render(
    <WithdrawPanel
      stream={makeStream()}
      available={50_000_000n}
      state="active"
      wallet={wallet}
      onWithdrawn={onWithdrawn}
    />,
  );
  return { onWithdrawn };
}

describe("WithdrawPanel", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    withdrawMock.mockResolvedValue("txhash");
  });

  it("opens a confirm modal showing the amount, and cancel signs nothing", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Cash out all" }));
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Cash out" }),
    ).toBeInTheDocument();
    // Withdraw-all resolves to the full available (5 XLM).
    expect(within(dialog).getByText("5 XLM")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(withdrawMock).not.toHaveBeenCalled();
  });

  it("withdraws only after confirming and records a receipt", async () => {
    const { onWithdrawn } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Cash out all" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm cash-out" }));
    await waitFor(() => expect(withdrawMock).toHaveBeenCalledOnce());
    expect(withdrawMock).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 50_000_000n, streamId: 6n }),
    );
    expect(onWithdrawn).toHaveBeenCalled();
    // A receipt row appears with an explorer link.
    expect(
      await screen.findByRole("link", { name: "Receipt" }),
    ).toBeInTheDocument();
  });
});
