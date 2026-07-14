import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Outlet } from "react-router-dom";
import type { WorkerContext } from "../../components/worker/context";
import type { FundState } from "../../hooks/useDemoWallet";
import { WalletTab } from "./WalletTab";

const ADDRESS = "GCQGDN634N7LNECZNWXUYHW2OFWNCQRG2CJHLBE4M375CNMXBLL2WKZN";

function renderWallet(
  overrides: Partial<WorkerContext> = {},
  fundState: FundState = "funded",
) {
  const ctx: WorkerContext = {
    wallet: {
      publicKey: ADDRESS,
      persisted: true,
      signTransactionXdr: vi.fn(),
    },
    fundState,
    retry: vi.fn(),
    firstRun: false,
    lockState: "legacy",
    lock: vi.fn(),
    refreshLockState: vi.fn(),
    ...overrides,
  };
  return render(
    <MemoryRouter>
      <Routes>
        <Route element={<Outlet context={ctx} />}>
          <Route path="*" element={<WalletTab />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("WalletTab", () => {
  it("shows the address and a copy button when funded", () => {
    renderWallet();
    expect(screen.getByText(ADDRESS)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy number" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Testnet ready")).toBeInTheDocument();
  });

  it("warns when the wallet is not persisted", () => {
    renderWallet({
      wallet: {
        publicKey: ADDRESS,
        persisted: false,
        signTransactionXdr: vi.fn(),
      },
    });
    expect(screen.getByText(/not saving your account/)).toBeInTheDocument();
  });

  it("shows the fund-later note when funding failed", () => {
    renderWallet({}, "failed");
    expect(screen.getByText("Fund later")).toBeInTheDocument();
    expect(
      screen.getByText(/free test funds have not arrived/),
    ).toBeInTheDocument();
  });

  it("offers wallet set-up when no wallet exists", () => {
    renderWallet({ wallet: null, lockState: "none" });
    expect(
      screen.getByRole("link", { name: "Set up your account" }),
    ).toHaveAttribute("href", "/worker/onboarding");
  });

  it("links to Settings for backup/restore instead of hosting it", () => {
    renderWallet();
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/worker/settings",
    );
    expect(
      screen.queryByText("Back up or restore this account"),
    ).not.toBeInTheDocument();
  });
});
