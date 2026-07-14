import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "./App";

// Route-map regression. Mount AppRoutes under a MemoryRouter at various paths and
// assert the right screen renders. The employer and worker pages reach the chain
// on mount, so their boundary hooks are stubbed to their initial states.

vi.mock("./hooks/useWallet", () => ({
  useWallet: () => ({
    status: { kind: "checking" },
    accessError: null,
    connect: vi.fn(),
  }),
}));

vi.mock("./hooks/useWorkerStream", () => ({
  useWorkerStream: () => ({
    error: null,
    loading: true,
    stream: null,
    state: null,
    chainAccrued: 0n,
    anchorLedgerSeconds: 0n,
    anchorMs: 0,
    lastSyncedMs: null,
    refresh: vi.fn(),
  }),
}));

// The worker shell loads the demo wallet (SDK keypair + friendbot) on mount; stub
// it so route tests never touch the network or the SDK ed25519 path under jsdom.
vi.mock("./hooks/useDemoWallet", () => ({
  useDemoWallet: () => ({
    wallet: {
      publicKey: "GCQGDN634N7LNECZNWXUYHW2OFWNCQRG2CJHLBE4M375CNMXBLL2WKZN",
      persisted: true,
      signTransactionXdr: vi.fn(),
    },
    lockState: "legacy",
    fundState: "funded",
    retry: vi.fn(),
    createWallet: vi.fn(),
    unlock: vi.fn(),
    lock: vi.fn(),
    refreshLockState: vi.fn(),
  }),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe("AppRoutes", () => {
  it("renders the landing at / with both role doors and the testnet badge", () => {
    renderAt("/");
    expect(
      screen.getByText("Get paid every second you work."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open the employer dashboard" }),
    ).toHaveAttribute("href", "/employer");
    expect(
      screen.getByRole("link", { name: "Open the worker app" }),
    ).toHaveAttribute("href", "/worker");
    expect(screen.getByText("TESTNET")).toBeInTheDocument();
  });

  it("renders the employer area at /employer (sign-in gate when disconnected)", () => {
    renderAt("/employer");
    expect(
      screen.getByText("Sign in with your wallet app"),
    ).toBeInTheDocument();
  });

  it("gates /employer/settings behind the sign-in gate when disconnected", () => {
    renderAt("/employer/settings");
    expect(
      screen.getByText("Sign in with your wallet app"),
    ).toBeInTheDocument();
  });

  it("mounts the worker stream screen at /worker/:streamId", () => {
    renderAt("/worker/5");
    expect(screen.getByText("Loading your paycheck")).toBeInTheDocument();
  });

  it("routes /worker/activity to Activity, not the stream detail", () => {
    renderAt("/worker/activity");
    expect(
      screen.getByRole("heading", { name: "Activity" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Loading your paycheck")).not.toBeInTheDocument();
  });

  it("routes /worker/wallet to the Wallet tab, not the stream detail", () => {
    renderAt("/worker/wallet");
    expect(
      screen.getByRole("heading", { name: "Your account" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Loading your paycheck")).not.toBeInTheDocument();
  });

  it("routes /worker/settings to Settings, not the stream detail", () => {
    renderAt("/worker/settings");
    expect(
      screen.getByRole("heading", { name: "Settings" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Loading your paycheck")).not.toBeInTheDocument();
  });

  it("renders NotFound for an unknown path", () => {
    renderAt("/nope");
    expect(screen.getByText("Page not found")).toBeInTheDocument();
  });
});
