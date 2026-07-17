import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { WalletStatus } from "../../lib/wallet";
import type { UseWallet } from "../../hooks/useWallet";

import { SignInGate } from "./SignInGate";

// The sign-in gate is a centered card, but WalletConnect was born in the
// header's right edge (T-010) and once hard-coded that alignment, so failure
// states (the T-056 bug: Freighter on PUBLIC) rendered their action pushed
// right while the copy centered. SC-18 pins the fix for every non-connected
// state the gate can show.

function makeWallet(status: WalletStatus, accessError: string | null = null) {
  const wallet: UseWallet = {
    status,
    accessError,
    connect: vi.fn(() => Promise.resolve()),
    refresh: vi.fn(() => Promise.resolve()),
    signOut: vi.fn(),
  };
  return wallet;
}

const nonConnectedStates: WalletStatus[] = [
  { kind: "checking" },
  { kind: "not-installed" },
  { kind: "wrong-network", network: "PUBLIC" },
  { kind: "disconnected" },
];

describe("SC-18: sign-in gate wallet guidance follows the card's centered layout", () => {
  it("sc18_signin_gate_wallet_guidance_centered_not_header_aligned", () => {
    for (const status of nonConnectedStates) {
      const { container, unmount } = render(
        <SignInGate wallet={makeWallet(status, "declined")} />,
      );
      // The centered column is present and the header's right alignment
      // never leaks into the card, for the status row and the access error.
      expect(container.querySelector(".items-center")).not.toBeNull();
      expect(container.querySelector(".items-end")).toBeNull();
      unmount();
    }
  });

  it("keeps the wrong-network guidance and its action together in the card", () => {
    render(
      <SignInGate
        wallet={makeWallet({ kind: "wrong-network", network: "PUBLIC" })}
      />,
    );
    expect(
      screen.getByText("Your wallet app is on PUBLIC. Switch it to Testnet."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
