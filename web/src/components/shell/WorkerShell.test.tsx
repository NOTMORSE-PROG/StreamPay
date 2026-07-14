import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// WorkerShell lock behavior (T-043): the locked state swaps the page content
// for the unlock screen WITHOUT navigating (deep links unlock in place), the
// padlock shows only for an unlocked vault, and auto-lock fires after the app
// has been hidden past the timeout, honoring the Settings toggle.

const useDemoWalletMock = vi.hoisted(() => vi.fn());
vi.mock("../../hooks/useDemoWallet", () => ({
  useDemoWallet: useDemoWalletMock,
}));

const hasVaultMock = vi.hoisted(() => vi.fn());
vi.mock("../../lib/vault", () => ({
  hasVault: hasVaultMock,
}));

vi.mock("../../lib/demoWallet", () => ({
  hasStoredDemoWallet: () => true,
  clearDemoWallet: vi.fn(),
  importSecretWithPin: vi.fn(),
}));

import { WorkerShell } from "./WorkerShell";

const WALLET = {
  publicKey: "GCQGDN634N7LNECZNWXUYHW2OFWNCQRG2CJHLBE4M375CNMXBLL2WKZN",
  persisted: true,
  signTransactionXdr: vi.fn(),
};

function hookValue(overrides: Record<string, unknown> = {}) {
  return {
    wallet: WALLET,
    lockState: "legacy",
    fundState: "funded",
    retry: vi.fn(),
    createWallet: vi.fn(),
    unlock: vi.fn(),
    lock: vi.fn(),
    refreshLockState: vi.fn(),
    ...overrides,
  };
}

function renderShellAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/worker" element={<WorkerShell />}>
          <Route index element={<div>HOME PAGE</div>} />
          <Route path=":streamId" element={<div>STREAM PAGE</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function setVisibility(state: "hidden" | "visible") {
  Object.defineProperty(document, "visibilityState", {
    value: state,
    configurable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  localStorage.clear();
  hasVaultMock.mockReturnValue(false);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("WorkerShell lock gating", () => {
  it("renders the unlock screen in place of a locked deep link, no redirect", () => {
    useDemoWalletMock.mockReturnValue(
      hookValue({ wallet: null, lockState: "locked" }),
    );
    hasVaultMock.mockReturnValue(true);
    renderShellAt("/worker/5");

    expect(screen.getByText("Enter your PIN")).toBeInTheDocument();
    expect(screen.queryByText("STREAM PAGE")).not.toBeInTheDocument();
    // The tab chrome stays: this is a content swap, not a navigation.
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
  });

  it("renders the page content once unlocked", () => {
    useDemoWalletMock.mockReturnValue(hookValue({ lockState: "unlocked" }));
    hasVaultMock.mockReturnValue(true);
    renderShellAt("/worker/5");
    expect(screen.getByText("STREAM PAGE")).toBeInTheDocument();
    expect(screen.queryByText("Enter your PIN")).not.toBeInTheDocument();
  });

  it("shows the padlock only for an unlocked vault, and it locks", () => {
    const lock = vi.fn();
    useDemoWalletMock.mockReturnValue(
      hookValue({ lockState: "unlocked", lock }),
    );
    hasVaultMock.mockReturnValue(true);
    renderShellAt("/worker");

    fireEvent.click(screen.getByRole("button", { name: "Lock the app now" }));
    expect(lock).toHaveBeenCalled();
  });

  it("hides the padlock in the legacy (no vault) world", () => {
    useDemoWalletMock.mockReturnValue(hookValue({ lockState: "legacy" }));
    renderShellAt("/worker");
    expect(
      screen.queryByRole("button", { name: "Lock the app now" }),
    ).not.toBeInTheDocument();
  });
});

describe("WorkerShell auto-lock", () => {
  it("locks after 5 hidden minutes, not after 4", () => {
    vi.useFakeTimers();
    const lock = vi.fn();
    useDemoWalletMock.mockReturnValue(
      hookValue({ lockState: "unlocked", lock }),
    );
    hasVaultMock.mockReturnValue(true);
    renderShellAt("/worker");

    act(() => {
      setVisibility("hidden");
      vi.advanceTimersByTime(4 * 60_000);
    });
    expect(lock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(90_000); // backstop interval passes the 5min mark
    });
    expect(lock).toHaveBeenCalled();
    setVisibility("visible");
  });

  it("does not lock when the Settings toggle is off", () => {
    vi.useFakeTimers();
    localStorage.setItem("streampay:worker:autolock", "off");
    const lock = vi.fn();
    useDemoWalletMock.mockReturnValue(
      hookValue({ lockState: "unlocked", lock }),
    );
    hasVaultMock.mockReturnValue(true);
    renderShellAt("/worker");

    act(() => {
      setVisibility("hidden");
      vi.advanceTimersByTime(10 * 60_000);
    });
    expect(lock).not.toHaveBeenCalled();
    setVisibility("visible");
  });

  it("never auto-locks in the legacy world", () => {
    vi.useFakeTimers();
    const lock = vi.fn();
    useDemoWalletMock.mockReturnValue(hookValue({ lockState: "legacy", lock }));
    renderShellAt("/worker");

    act(() => {
      setVisibility("hidden");
      vi.advanceTimersByTime(10 * 60_000);
    });
    expect(lock).not.toHaveBeenCalled();
    setVisibility("visible");
  });
});
