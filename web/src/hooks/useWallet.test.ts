import { describe, expect, it, vi } from "vitest";
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

const ADDRESS = "GAWCHLI2XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

describe("useWallet", () => {
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
});
