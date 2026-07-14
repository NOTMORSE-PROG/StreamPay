import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Landing } from "./Landing";

describe("Landing", () => {
  function renderLanding() {
    return render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>,
    );
  }

  it("offers both role doors pointing at the two areas", () => {
    renderLanding();
    expect(
      screen.getByRole("link", { name: "Open the employer dashboard" }),
    ).toHaveAttribute("href", "/employer");
    expect(
      screen.getByRole("link", { name: "Open the worker app" }),
    ).toHaveAttribute("href", "/worker");
  });

  it("states the honest testnet scope", () => {
    renderLanding();
    expect(
      screen.getByText(/live demo on the Stellar test network/i),
    ).toBeInTheDocument();
  });

  it("uses no gradient styling (decision 15)", () => {
    const { container } = renderLanding();
    expect(container.innerHTML).not.toMatch(/gradient/);
  });
});
