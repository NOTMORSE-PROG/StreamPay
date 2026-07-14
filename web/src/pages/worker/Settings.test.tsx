import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Outlet } from "react-router-dom";
import type { WorkerContext } from "../../components/worker/context";
import { WorkerSettings } from "./Settings";
import { getWorkerProfile, setWorkerName } from "../../lib/profile";

// The worker Settings tab (T-042/T-043): sections render, the profile name
// persists, and the security card swaps to the lock controls for a vault
// holder. The vault check is mocked; the real crypto is covered by the
// node-env suites.

const hasVaultMock = vi.hoisted(() => vi.fn());
vi.mock("../../lib/vault", () => ({
  hasVault: hasVaultMock,
}));

const migrateLegacyToPinMock = vi.hoisted(() => vi.fn());
const changePinMock = vi.hoisted(() => vi.fn());
const lockWalletMock = vi.hoisted(() => vi.fn());
vi.mock("../../lib/demoWallet", () => ({
  migrateLegacyToPin: migrateLegacyToPinMock,
  changePin: changePinMock,
  lockWallet: lockWalletMock,
  // BackupRestore and the log-out dialog (rendered inside Settings) import these:
  exportSecretWithPin: vi.fn(),
  importSecretWithPin: vi.fn(),
}));

const wipeWorkerDeviceMock = vi.hoisted(() => vi.fn());
vi.mock("../../lib/wipe", () => ({
  wipeWorkerDevice: wipeWorkerDeviceMock,
}));

const baseCtx: WorkerContext = {
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

function renderSettings(overrides: Partial<WorkerContext> = {}) {
  const ctx = { ...baseCtx, ...overrides };
  return render(
    <MemoryRouter>
      <Routes>
        <Route element={<Outlet context={ctx} />}>
          <Route path="*" element={<WorkerSettings />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function setPin(pin: string) {
  // The security card's SetPinForm renders before BackupRestore's, so its
  // "Choose a PIN" / "Confirm PIN" are the first two PIN fields on the page.
  const fields = screen.getAllByLabelText(/PIN/);
  fireEvent.change(fields[0], { target: { value: pin } });
  fireEvent.change(fields[1], { target: { value: pin } });
}

beforeEach(() => {
  localStorage.clear();
  hasVaultMock.mockReturnValue(false);
  migrateLegacyToPinMock.mockResolvedValue(true);
  changePinMock.mockResolvedValue({ ok: true });
});

describe("WorkerSettings", () => {
  it("renders every section", () => {
    renderSettings();
    expect(
      screen.getByRole("heading", { name: "Settings" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Profile" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Display currency" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Account security" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Back up or restore this account"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Network" }),
    ).toBeInTheDocument();
  });

  it("saves the display name and disables the button until dirty", () => {
    renderSettings();
    const save = screen.getByRole("button", { name: "Save name" });
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Maria" },
    });
    expect(save).toBeEnabled();
    fireEvent.click(save);

    expect(getWorkerProfile()).toEqual({ name: "Maria" });
    expect(save).toBeDisabled();
  });

  it("prefills and clears an existing name", () => {
    setWorkerName("Maria");
    renderSettings();
    const input = screen.getByLabelText("Display name");
    expect(input).toHaveValue("Maria");

    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save name" }));
    expect(getWorkerProfile()).toBeNull();
  });

  it("offers Set a PIN for a legacy wallet and migrates on submit", async () => {
    const refreshLockState = vi.fn();
    renderSettings({ lockState: "legacy", refreshLockState });

    setPin("123456");
    fireEvent.click(screen.getByRole("button", { name: "Set a PIN" }));
    await vi.waitFor(() =>
      expect(migrateLegacyToPinMock).toHaveBeenCalledWith("123456"),
    );
    await vi.waitFor(() => expect(refreshLockState).toHaveBeenCalled());
  });

  it("shows the passkey explainer for a wallet with no vault and no legacy key", () => {
    renderSettings({ lockState: "none", wallet: null });
    expect(screen.getByText(/protected by a passkey/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Lock now" }),
    ).not.toBeInTheDocument();
  });

  it("shows Change PIN, Lock now, and the auto-lock toggle for an unlocked vault", () => {
    hasVaultMock.mockReturnValue(true);
    const lock = vi.fn();
    renderSettings({ lockState: "unlocked", lock });

    expect(
      screen.getByRole("button", { name: "Change PIN" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lock now" }));
    expect(lock).toHaveBeenCalled();

    const toggle = screen.getByRole("checkbox", {
      name: /Lock automatically/,
    });
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    expect(localStorage.getItem("streampay:worker:autolock")).toBe("off");
    fireEvent.click(toggle);
    expect(localStorage.getItem("streampay:worker:autolock")).toBeNull();
  });

  it("shows the currency toggle", () => {
    renderSettings();
    expect(screen.getByRole("button", { name: "XLM" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "USD" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PHP" })).toBeInTheDocument();
  });

  it("gates log-out behind the acknowledgement checkbox, then wipes", () => {
    renderSettings();
    fireEvent.click(
      screen.getByRole("button", { name: "Log out of this device" }),
    );
    const erase = screen.getByRole("button", { name: "Erase and log out" });
    expect(erase).toBeDisabled();

    fireEvent.click(
      screen.getByRole("checkbox", { name: /I have saved my backup code/ }),
    );
    expect(erase).toBeEnabled();
    fireEvent.click(erase);
    expect(wipeWorkerDeviceMock).toHaveBeenCalled();
  });
});
