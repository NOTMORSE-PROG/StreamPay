import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { WalletStatus } from "../../lib/wallet";

// The employer shell gates the whole area on a connected wallet. Stub useWallet
// and mount the shell with a marker child route, so we can assert the gate hides
// the outlet when disconnected and reveals nav + outlet when connected.

const useWalletMock = vi.hoisted(() => vi.fn());
vi.mock("../../hooks/useWallet", () => ({ useWallet: useWalletMock }));

import { EmployerShell } from "./EmployerShell";

function setStatus(status: WalletStatus) {
  useWalletMock.mockReturnValue({
    status,
    accessError: null,
    connect: vi.fn(),
    refresh: vi.fn(),
  });
}

function renderShell() {
  return render(
    <MemoryRouter initialEntries={["/employer"]}>
      <Routes>
        <Route path="/employer" element={<EmployerShell />}>
          <Route index element={<div>OUTLET CONTENT</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("EmployerShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the sign-in gate and hides the outlet when disconnected", () => {
    setStatus({ kind: "disconnected" });
    renderShell();
    expect(
      screen.getByText("Sign in with your wallet app"),
    ).toBeInTheDocument();
    expect(screen.queryByText("OUTLET CONTENT")).not.toBeInTheDocument();
    // No worker navigation is ever reachable from the employer shell.
    expect(screen.queryByText("For workers")).not.toBeInTheDocument();
  });

  it("surfaces the wrong-network guidance in the gate", () => {
    setStatus({ kind: "wrong-network", network: "PUBLIC" });
    renderShell();
    expect(screen.getByText(/Switch it to Testnet/)).toBeInTheDocument();
    expect(screen.queryByText("OUTLET CONTENT")).not.toBeInTheDocument();
  });

  it("reveals the nav and the outlet when connected", () => {
    setStatus({
      kind: "connected",
      address: "GAWCHLI26MZCP4UISX7TSY4SOBRQOKYOANKEQKQWTX4KFFGUYN5LH6V4",
    });
    renderShell();
    expect(screen.getByText("OUTLET CONTENT")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create stream" }),
    ).toBeInTheDocument();
  });
});
