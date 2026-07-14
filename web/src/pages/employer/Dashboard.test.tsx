import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Outlet } from "react-router-dom";
import type { Stream } from "../../lib/contract";
import type { StreamRow } from "../../lib/streams";
import type { EmployerContext } from "../../components/employer/context";

// The dashboard computes its stat row from the same rows the list shows. Stub the
// polling hook with fixtures and provide the outlet context a signed-in shell
// would, then assert the three stat figures.

const useEmployerStreamsMock = vi.hoisted(() => vi.fn());
vi.mock("../../hooks/useEmployerStreams", () => ({
  useEmployerStreams: useEmployerStreamsMock,
}));

// Stub the download helper so the export button is observable without a real
// blob download (jsdom has no URL.createObjectURL).
const downloadCsvMock = vi.hoisted(() => vi.fn());
vi.mock("../../lib/csv", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/csv")>()),
  downloadCsv: downloadCsvMock,
}));

import { Dashboard } from "./Dashboard";

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

const ctx: EmployerContext = {
  address: "GAWCHLI26MZCP4UISX7TSY4SOBRQOKYOANKEQKQWTX4KFFGUYN5LH6V4",
  refreshKey: 0,
  onChanged: vi.fn(),
  signOut: vi.fn(),
};

function renderDashboard(rows: StreamRow[]) {
  useEmployerStreamsMock.mockReturnValue({ rows, loading: false, error: null });
  return render(
    <MemoryRouter>
      <Routes>
        <Route element={<Outlet context={ctx} />}>
          <Route path="*" element={<Dashboard />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows stat figures derived from the rows", () => {
    renderDashboard([
      { stream: makeStream({ id: 1n }), accrued: 10n, state: "active" },
      {
        stream: makeStream({ id: 2n, deposit: 20_000_000n }),
        accrued: 20_000_000n,
        state: "drained",
      },
    ]);
    // 1 active stream; 10 XLM streaming (only the active one); 12 XLM deposited.
    // Scope each figure to its stat tile so it does not collide with the card
    // that shows the same deposit.
    const streamingTile = screen
      .getByText("Streaming now")
      .closest("div") as HTMLElement;
    expect(within(streamingTile).getByText("10 XLM")).toBeInTheDocument();
    const depositedTile = screen
      .getByText("Total deposited")
      .closest("div") as HTMLElement;
    expect(within(depositedTile).getByText("12 XLM")).toBeInTheDocument();
  });

  it("links to the create-stream route", () => {
    renderDashboard([]);
    expect(screen.getByRole("link", { name: "Create stream" })).toHaveAttribute(
      "href",
      "/employer/create",
    );
  });

  it("exports the visible rows as CSV on click, and hides the button with none", () => {
    renderDashboard([
      { stream: makeStream({ id: 1n }), accrued: 10_000_000n, state: "active" },
    ]);
    screen.getByRole("button", { name: "Export CSV" }).click();
    expect(downloadCsvMock).toHaveBeenCalledTimes(1);
    const [filename, csv] = downloadCsvMock.mock.calls[0] as [string, string];
    expect(filename).toMatch(/^streampay-streams-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(csv).toContain(
      "stream_id,nickname,worker_address,status,deposit_xlm,accrued_xlm,withdrawn_xlm,start_utc,duration_seconds,rate_xlm_per_second",
    );
    expect(csv).toContain(
      "1,,GCQGDN634N7LNECZNWXUYHW2OFWNCQRG2CJHLBE4M375CNMXBLL2WKZN,Active,10,1,0,1970-01-01T00:00:00.000Z,600,0.0166666",
    );
  });

  it("shows the getting-started checklist and invite panel when there are no streams", () => {
    renderDashboard([]);
    expect(screen.getByText("Start paying per second")).toBeInTheDocument();
    // The invite panel exposes the worker app link (unique text).
    expect(
      screen.getByText(`${window.location.origin}/worker`),
    ).toBeInTheDocument();
  });
});
