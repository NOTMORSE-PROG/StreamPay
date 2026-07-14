import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CashOut } from "./CashOut";

function renderCashOut() {
  return render(
    <MemoryRouter>
      <CashOut />
    </MemoryRouter>,
  );
}

describe("CashOut", () => {
  it("explains the USDC currency story honestly", () => {
    renderCashOut();
    expect(screen.getByText(/that is\s+USDC/i)).toBeInTheDocument();
    expect(screen.getByText(/test-XLM\) stand in/i)).toBeInTheDocument();
  });

  it("lists the cash-out rails, each marked a production feature", () => {
    renderCashOut();
    expect(screen.getByText("Bank transfer")).toBeInTheDocument();
    expect(screen.getByText("Cash pickup")).toBeInTheDocument();
    // Every rail carries the production-feature label (no fake conversion here).
    expect(screen.getAllByText("Production feature")).toHaveLength(3);
  });

  it("states that the demo moves no real cash", () => {
    renderCashOut();
    expect(
      screen.getByText(/cash-out partners are not connected/i),
    ).toBeInTheDocument();
  });
});
