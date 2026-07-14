import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  resolveWalletStatus: vi.fn(),
  connectWallet: vi.fn(),
}));

vi.mock("../lib/wallet", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/wallet")>();
  return {
    ...actual,
    resolveWalletStatus: mocks.resolveWalletStatus,
    connectWallet: mocks.connectWallet,
  };
});

const { useWallet } = await import("./useWallet");
const { WalletAccessError } = await import("../lib/wallet");
const { clearSignedOut } = await import("../lib/employerSession");

const ADDRESS = "GAWCHLI2XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

describe("useWallet", () => {
  beforeEach(() => {
    clearSignedOut();
    localStorage.clear();
    mocks.resolveWalletStatus.mockReset();
    mocks.connectWallet.mockReset();
  });

  it("detects the wallet status on mount", async () => {
    mocks.resolveWalletStatus.mockResolvedValue({
      kind: "connected",
      address: ADDRESS,
    });
    const { result } = renderHook(() => useWallet());
    expect(result.current.status).toEqual({ kind: "checking" });
    await waitFor(() =>
      expect(result.current.status).toEqual({
        kind: "connected",
        address: ADDRESS,
      }),
    );
  });

  it("surfaces a friendly message when the user declines connect", async () => {
    mocks.resolveWalletStatus.mockResolvedValue({ kind: "disconnected" });
    mocks.connectWallet.mockRejectedValue(new WalletAccessError("declined"));
    const { result } = renderHook(() => useWallet());
    await waitFor(() =>
      expect(result.current.status).toEqual({ kind: "disconnected" }),
    );
    await act(async () => {
      await result.current.connect();
    });
    expect(result.current.accessError).toMatch(/declined/i);
  });

  it("signing out forces disconnected even when Freighter reports connected", async () => {
    mocks.resolveWalletStatus.mockResolvedValue({
      kind: "connected",
      address: ADDRESS,
    });
    const { result } = renderHook(() => useWallet());
    await waitFor(() =>
      expect(result.current.status).toEqual({
        kind: "connected",
        address: ADDRESS,
      }),
    );

    act(() => {
      result.current.signOut();
    });
    expect(result.current.status).toEqual({ kind: "disconnected" });

    // The window-focus re-resolve must honor the flag, not snap back.
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.status).toEqual({ kind: "disconnected" });
  });

  it("connecting clears the signed-out flag and proceeds", async () => {
    mocks.resolveWalletStatus.mockResolvedValue({ kind: "disconnected" });
    mocks.connectWallet.mockResolvedValue({
      kind: "connected",
      address: ADDRESS,
    });
    const { result } = renderHook(() => useWallet());
    await waitFor(() =>
      expect(result.current.status).toEqual({ kind: "disconnected" }),
    );

    act(() => {
      result.current.signOut();
    });
    await act(async () => {
      await result.current.connect();
    });
    expect(result.current.status).toEqual({
      kind: "connected",
      address: ADDRESS,
    });
  });
});
