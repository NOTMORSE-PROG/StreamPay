import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { InvitePanel } from "./InvitePanel";
import { setBusinessName } from "../../lib/employerProfile";

describe("InvitePanel", () => {
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    localStorage.clear();
    writeText.mockClear();
    Object.assign(navigator, { clipboard: { writeText } });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("weaves the business name into the invite message, with a clean default", () => {
    const { unmount } = render(<InvitePanel />);
    fireEvent.click(screen.getByRole("button", { name: "Copy message" }));
    expect(writeText).toHaveBeenLastCalledWith(
      expect.stringContaining("Join me on StreamPay"),
    );
    unmount();

    setBusinessName("Acme Co");
    render(<InvitePanel />);
    fireEvent.click(screen.getByRole("button", { name: "Copy message" }));
    expect(writeText).toHaveBeenLastCalledWith(
      expect.stringContaining("Join Acme Co on StreamPay"),
    );
  });

  it("shows the worker app link for the current origin", () => {
    render(<InvitePanel />);
    expect(screen.getByText("Invite your worker")).toBeInTheDocument();
    // The panel exposes the /worker link (jsdom origin is http://localhost).
    expect(
      screen.getByText(`${window.location.origin}/worker`),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy link" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy message" }),
    ).toBeInTheDocument();
  });

  it("renders a QR code image for the link", () => {
    render(<InvitePanel />);
    expect(
      screen.getByRole("img", { name: "QR code of the worker app link" }),
    ).toBeInTheDocument();
  });
});
