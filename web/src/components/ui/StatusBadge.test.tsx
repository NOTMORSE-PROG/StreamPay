import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge";
import type { LifecycleState } from "../../lib/streams";

// The one badge that replaced the three duplicated lifecycle maps. Assert each
// state renders its label, and that the worker context relabels "active".

describe("StatusBadge", () => {
  const cases: Array<[LifecycleState, string]> = [
    ["active", "Active"],
    ["completed", "Completed"],
    ["drained", "Drained"],
    ["cancelled", "Cancelled"],
  ];

  for (const [state, label] of cases) {
    it(`renders the employer label for ${state}`, () => {
      render(<StatusBadge state={state} />);
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  }

  it("relabels an active stream as Getting paid in the worker context", () => {
    render(<StatusBadge state="active" context="worker" />);
    expect(screen.getByText("Getting paid")).toBeInTheDocument();
    expect(screen.queryByText("Active")).not.toBeInTheDocument();
  });

  it("keeps the shared label for non-active states in the worker context", () => {
    render(<StatusBadge state="cancelled" context="worker" />);
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });
});
