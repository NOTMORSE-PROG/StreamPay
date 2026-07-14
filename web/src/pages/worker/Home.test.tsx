import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Outlet } from "react-router-dom";
import type { Stream } from "../../lib/contract";
import type { StreamRow } from "../../lib/streams";
import type { WorkerContext } from "../../components/worker/context";

// Worker Home totals and per-stream links. Stub the polling hook with fixtures and
// provide the worker outlet context (a loaded demo wallet).

const useWorkerStreamsMock = vi.hoisted(() => vi.fn());
vi.mock("../../hooks/useWorkerStreams", () => ({
  useWorkerStreams: useWorkerStreamsMock,
}));

import { WorkerHome } from "./Home";

function makeStream(overrides: Partial<Stream> = {}): Stream {
  return {
    id: 1n,
    employer: "GAWCHLI26MZCP4UISX7TSY4SOBRQOKYOANKEQKQWTX4KFFGUYN5LH6V4",
    worker: "GCQGDN634N7LNECZNWXUYHW2OFWNCQRG2CJHLBE4M375CNMXBLL2WKZN",
    token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    deposit: 100_000_000n,
    start: 0n,
    duration: 600n,
    withdrawn: 0n,
    cancelled: false,
    ...overrides,
  };
}

const ctx: WorkerContext = {
  wallet: {
    publicKey: "GCQGDN634N7LNECZNWXUYHW2OFWNCQRG2CJHLBE4M375CNMXBLL2WKZN",
    persisted: true,
    signTransactionXdr: vi.fn(),
  },
  fundState: "funded",
  retry: vi.fn(),
  firstRun: false,
  lockState: "legacy",
  lock: vi.fn(),
  refreshLockState: vi.fn(),
};

function renderHome(
  rows: StreamRow[],
  loading = false,
  context: WorkerContext = ctx,
) {
  useWorkerStreamsMock.mockReturnValue({
    rows,
    loading,
    error: null,
    lastSyncedMs: Date.now(),
  });
  return render(
    <MemoryRouter initialEntries={["/worker"]}>
      <Routes>
        <Route element={<Outlet context={context} />}>
          <Route path="/worker" element={<WorkerHome />} />
        </Route>
        <Route path="/worker/onboarding" element={<div>WIZARD MARKER</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("WorkerHome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("hides the amounts when the privacy toggle is on, and restores them", () => {
    renderHome([
      { stream: makeStream({ id: 1n }), accrued: 30_000_000n, state: "active" },
    ]);
    expect(screen.queryByText("••••")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hide amounts" }));
    // The Stat values and the card amount all mask; the hint reads "Hidden".
    expect(screen.getAllByText("••••").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Hidden").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Show amounts" }));
    expect(screen.queryByText("••••")).not.toBeInTheDocument();
  });

  it("shows the employer label on a card when one is set", () => {
    const employer = "GAWCHLI26MZCP4UISX7TSY4SOBRQOKYOANKEQKQWTX4KFFGUYN5LH6V4";
    localStorage.setItem(
      "streampay:worker:employer-labels",
      JSON.stringify({ v: 1, labels: { [employer]: "Acme Co" } }),
    );
    renderHome([
      {
        stream: makeStream({ id: 1n, employer }),
        accrued: 10_000_000n,
        state: "active",
      },
    ]);
    expect(screen.getByText("from Acme Co")).toBeInTheDocument();
  });

  it("offers wallet set-up when onboarded but no wallet exists", () => {
    renderHome([], false, { ...ctx, wallet: null, lockState: "none" });
    expect(
      screen.getByRole("link", { name: "Set up your account" }),
    ).toHaveAttribute("href", "/worker/onboarding");
  });

  it("greets by the profile name when one is set, and not otherwise", () => {
    const { unmount } = renderHome([]);
    expect(screen.queryByText(/^Hi,/)).not.toBeInTheDocument();
    unmount();

    localStorage.setItem(
      "streampay:worker:profile",
      JSON.stringify({ v: 1, name: "Maria" }),
    );
    renderHome([]);
    expect(screen.getByText("Hi, Maria")).toBeInTheDocument();
  });

  it("sums the available amount across streams", () => {
    renderHome([
      { stream: makeStream({ id: 1n }), accrued: 30_000_000n, state: "active" },
      {
        stream: makeStream({ id: 2n, withdrawn: 10_000_000n }),
        accrued: 20_000_000n,
        state: "active",
      },
    ]);
    // available = (30M - 0) + (20M - 10M) = 40M = 4 XLM.
    const availableTile = screen
      .getByText("Available now")
      .closest("div") as HTMLElement;
    expect(within(availableTile).getByText("4")).toBeInTheDocument();
  });

  it("links each stream card to its detail route", () => {
    renderHome([
      { stream: makeStream({ id: 7n }), accrued: 10n, state: "active" },
    ]);
    const link = screen.getByRole("link", { name: /Paycheck #7/ });
    expect(link).toHaveAttribute("href", "/worker/7");
  });

  it("separates past streams from active ones", () => {
    renderHome([
      { stream: makeStream({ id: 1n }), accrued: 10n, state: "active" },
      {
        stream: makeStream({ id: 2n }),
        accrued: 100_000_000n,
        state: "cancelled",
      },
    ]);
    expect(screen.getByText("Getting paid now")).toBeInTheDocument();
    expect(screen.getByText("Past")).toBeInTheDocument();
  });

  it("shows an empty state pointing at the wallet tab", () => {
    renderHome([]);
    expect(
      screen.getByRole("link", { name: "Show my account number" }),
    ).toHaveAttribute("href", "/worker/wallet");
  });

  it("redirects a first-run visitor to the onboarding wizard", () => {
    renderHome([], false, { ...ctx, firstRun: true });
    expect(screen.getByText("WIZARD MARKER")).toBeInTheDocument();
    expect(screen.queryByText("Your earnings")).not.toBeInTheDocument();
  });
});
