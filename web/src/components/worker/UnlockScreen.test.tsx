import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { UnlockResult } from "../../lib/demoWallet";
import { UnlockScreen } from "./UnlockScreen";

// The unlock screen (T-043): wrong-PIN handling with the fat-finger delay,
// the corrupt-vault message, digits-only input, and the forgot-PIN dialog's
// checkbox gate. demoWallet is mocked; the crypto truth lives in the node
// suites.

const clearDemoWalletMock = vi.hoisted(() => vi.fn());
const importSecretWithPinMock = vi.hoisted(() => vi.fn());
vi.mock("../../lib/demoWallet", () => ({
  clearDemoWallet: clearDemoWalletMock,
  importSecretWithPin: importSecretWithPinMock,
}));

function renderUnlock(onUnlock: (pin: string) => Promise<UnlockResult>) {
  return render(
    <MemoryRouter>
      <UnlockScreen onUnlock={onUnlock} />
    </MemoryRouter>,
  );
}

function typePin(pin: string) {
  fireEvent.change(screen.getByLabelText("PIN"), { target: { value: pin } });
}

beforeEach(() => {
  vi.useFakeTimers();
  clearDemoWalletMock.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("UnlockScreen", () => {
  it("keeps Unlock disabled until 6 digits and strips non-digits", () => {
    renderUnlock(vi.fn());
    const button = screen.getByRole("button", { name: "Unlock" });
    typePin("12ab3");
    expect(screen.getByLabelText("PIN")).toHaveValue("123");
    expect(button).toBeDisabled();
    typePin("123456");
    expect(button).toBeEnabled();
  });

  it("shows the wrong-PIN error and cools down before the next try", async () => {
    const onUnlock = vi
      .fn()
      .mockResolvedValue({ ok: false, reason: "wrong-pin" });
    renderUnlock(onUnlock);

    typePin("111111");
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "That PIN is not right",
    );
    // Cooling down: even a complete PIN cannot submit yet.
    typePin("222222");
    expect(
      screen.getByRole("button", { name: "Wait a moment" }),
    ).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(screen.getByRole("button", { name: "Unlock" })).toBeEnabled();
  });

  it("shows the damaged-vault message on corrupt without a cooldown", async () => {
    const onUnlock = vi
      .fn()
      .mockResolvedValue({ ok: false, reason: "corrupt" });
    renderUnlock(onUnlock);

    typePin("111111");
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByRole("alert")).toHaveTextContent(/damaged/);
    typePin("222222");
    expect(screen.getByRole("button", { name: "Unlock" })).toBeEnabled();
  });

  it("gates the forgot-PIN erase behind the checkbox, then offers restore", () => {
    renderUnlock(vi.fn());
    fireEvent.click(screen.getByRole("button", { name: "Forgot your PIN?" }));

    expect(screen.getByText(/We cannot recover your PIN/)).toBeInTheDocument();
    const erase = screen.getByRole("button", { name: "Erase this account" });
    expect(erase).toBeDisabled();

    fireEvent.click(
      screen.getByRole("checkbox", { name: /I understand this erases/ }),
    );
    expect(erase).toBeEnabled();
    fireEvent.click(erase);
    expect(clearDemoWalletMock).toHaveBeenCalled();

    // After erasing, the restore-or-start-fresh choice appears.
    expect(screen.getByLabelText("Backup code")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "No backup? Start fresh with a new account",
      }),
    ).toBeInTheDocument();
  });
});
