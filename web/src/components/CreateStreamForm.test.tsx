import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CreateStreamForm } from "./CreateStreamForm";

// The employer's own account; the worker must differ and be a valid strkey.
const EMPLOYER = "GAWCHLI26MZCP4UISX7TSY4SOBRQOKYOANKEQKQWTX4KFFGUYN5LH6V4";
const WORKER = "GCQGDN634N7LNECZNWXUYHW2OFWNCQRG2CJHLBE4M375CNMXBLL2WKZN";

function renderForm() {
  const onCreated = vi.fn();
  render(<CreateStreamForm employer={EMPLOYER} onCreated={onCreated} />);
  return { onCreated };
}

describe("CreateStreamForm", () => {
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
    fireEvent.change(screen.getByLabelText("Worker address"), {
      target: { value: "not-an-address" },
    });
    fireEvent.change(screen.getByLabelText("Total amount (test-XLM)"), {
      target: { value: "100" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create stream" }));
    expect(screen.getByText(/valid Stellar address/i)).toBeInTheDocument();
  });

  it("blocks the worker being the connected employer", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Worker address"), {
      target: { value: EMPLOYER },
    });
    fireEvent.change(screen.getByLabelText("Total amount (test-XLM)"), {
      target: { value: "100" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create stream" }));
    expect(
      screen.getByText(/different account from the employer/i),
    ).toBeInTheDocument();
  });

  it("blocks a zero amount", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Worker address"), {
      target: { value: WORKER },
    });
    fireEvent.change(screen.getByLabelText("Total amount (test-XLM)"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create stream" }));
    expect(screen.getByText(/greater than zero/i)).toBeInTheDocument();
  });
});
