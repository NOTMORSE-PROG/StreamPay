import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CreateStreamForm } from "./CreateStreamForm";
import {
  accountExists,
  createStream,
  getChainTime,
  getTokenBalance,
} from "../lib/contract";
import { resolveWalletStatus } from "../lib/wallet";

// The employer's own account; the worker must differ and be a valid strkey.
const EMPLOYER = "GAWCHLI26MZCP4UISX7TSY4SOBRQOKYOANKEQKQWTX4KFFGUYN5LH6V4";
const WORKER = "GCQGDN634N7LNECZNWXUYHW2OFWNCQRG2CJHLBE4M375CNMXBLL2WKZN";

// Mock the chain and wallet boundaries so the review-and-confirm flow can run
// without a network. Real error classes are kept for the form's instanceof checks.
vi.mock("../lib/contract", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/contract")>();
  return {
    ...actual,
    getTokenBalance: vi.fn(),
    accountExists: vi.fn(),
    getChainTime: vi.fn(),
    createStream: vi.fn(),
  };
});
vi.mock("../lib/wallet", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/wallet")>();
  return {
    ...actual,
    resolveWalletStatus: vi.fn(),
    signWithFreighter: vi.fn(),
  };
});

const getTokenBalanceMock = getTokenBalance as unknown as Mock;
const accountExistsMock = accountExists as unknown as Mock;
const getChainTimeMock = getChainTime as unknown as Mock;
const createStreamMock = createStream as unknown as Mock;
const resolveWalletStatusMock = resolveWalletStatus as unknown as Mock;

function renderForm() {
  const onCreated = vi.fn();
  render(<CreateStreamForm employer={EMPLOYER} onCreated={onCreated} />);
  return { onCreated };
}

function fillValid() {
  fireEvent.change(screen.getByLabelText("Worker's account number"), {
    target: { value: WORKER },
  });
  fireEvent.change(screen.getByLabelText("Total amount (test-XLM)"), {
    target: { value: "100" },
  });
}

describe("CreateStreamForm", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    getTokenBalanceMock.mockResolvedValue(1_000_000_000n);
    accountExistsMock.mockResolvedValue(true);
    getChainTimeMock.mockResolvedValue(0n);
    createStreamMock.mockResolvedValue({ streamId: 9n, hash: "hash9" });
    resolveWalletStatusMock.mockResolvedValue({
      kind: "connected",
      address: EMPLOYER,
    });
  });

  it("shows the live per-second rate matching the contract floor math", () => {
    renderForm();
    // 100 test-XLM over the default 10 minutes (600 s): floor(1e9 / 600) = 1,666,666
    // stroops per second = 0.1666666 XLM (matches the contract's 1-second accrual).
    fireEvent.change(screen.getByLabelText("Total amount (test-XLM)"), {
      target: { value: "100" },
    });
    expect(screen.getByText(/0\.1666666 XLM \/ second/)).toBeInTheDocument();
  });

  it("blocks a malformed worker address before any network call", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Worker's account number"), {
      target: { value: "not-an-address" },
    });
    fireEvent.change(screen.getByLabelText("Total amount (test-XLM)"), {
      target: { value: "100" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Review and start paying" }),
    );
    expect(screen.getByText(/valid Stellar address/i)).toBeInTheDocument();
    // No modal opened on invalid input.
    expect(screen.queryByText("Review this stream")).not.toBeInTheDocument();
  });

  it("blocks the worker being the connected employer", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Worker's account number"), {
      target: { value: EMPLOYER },
    });
    fireEvent.change(screen.getByLabelText("Total amount (test-XLM)"), {
      target: { value: "100" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Review and start paying" }),
    );
    expect(
      screen.getByText(/different account from the employer/i),
    ).toBeInTheDocument();
  });

  it("blocks a zero amount", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Worker's account number"), {
      target: { value: WORKER },
    });
    fireEvent.change(screen.getByLabelText("Total amount (test-XLM)"), {
      target: { value: "0" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Review and start paying" }),
    );
    expect(screen.getByText(/greater than zero/i)).toBeInTheDocument();
  });

  it("opens a review modal on valid input and can go back without signing", async () => {
    renderForm();
    fillValid();
    fireEvent.click(
      screen.getByRole("button", { name: "Review and start paying" }),
    );
    expect(
      await screen.findByText("Review before you start paying"),
    ).toBeInTheDocument();
    // The review shows the deposit and worker; nothing is signed yet.
    expect(screen.getByText("100 XLM")).toBeInTheDocument();
    expect(createStreamMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(
      screen.queryByText("Review before you start paying"),
    ).not.toBeInTheDocument();
  });

  it("signs and creates the stream only after confirming", async () => {
    const { onCreated } = renderForm();
    fillValid();
    fireEvent.click(
      screen.getByRole("button", { name: "Review and start paying" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Confirm and approve" }),
    );
    await waitFor(() => expect(createStreamMock).toHaveBeenCalledOnce());
    expect(onCreated).toHaveBeenCalledWith(9n);
    expect(await screen.findByText("Paycheck #9 started")).toBeInTheDocument();
  });

  it("fills the worker field from a saved worker in the picker", () => {
    localStorage.setItem(
      "streampay:workers",
      JSON.stringify([{ name: "Maria", address: WORKER }]),
    );
    renderForm();
    fireEvent.change(screen.getByLabelText("Saved worker"), {
      target: { value: WORKER },
    });
    expect(screen.getByLabelText("Worker's account number")).toHaveValue(
      WORKER,
    );
  });
});
