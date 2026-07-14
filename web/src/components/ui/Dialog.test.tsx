import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Dialog } from "./Dialog";

// The shared modal shell's accessibility contract: role/label, Escape to close,
// backdrop click to close, and a click inside the panel that does NOT close.

describe("Dialog", () => {
  it("renders as a labelled modal dialog", () => {
    render(
      <Dialog title="Confirm withdraw" onClose={() => {}}>
        <p>body</p>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Confirm withdraw")).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <Dialog title="Confirm" onClose={onClose}>
        <p>body</p>
      </Dialog>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes on a backdrop click but not on a panel click", () => {
    const onClose = vi.fn();
    render(
      <Dialog title="Confirm" onClose={onClose}>
        <button type="button">Inside</button>
      </Dialog>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Inside" }));
    expect(onClose).not.toHaveBeenCalled();
    // The backdrop is the dialog's grandparent wrapper; click it directly.
    const backdrop = screen.getByRole("dialog").parentElement as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("moves focus to the first focusable control on open", () => {
    render(
      <Dialog title="Confirm" onClose={() => {}}>
        <button type="button">First</button>
        <button type="button">Second</button>
      </Dialog>,
    );
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
  });
});
