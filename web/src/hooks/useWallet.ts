import { useCallback, useEffect, useState } from "react";
import {
  connectWallet,
  resolveWalletStatus,
  WalletAccessError,
  type WalletStatus,
} from "../lib/wallet";
import {
  clearSignedOut,
  isSignedOut,
  markSignedOut,
} from "../lib/employerSession";

export interface UseWallet {
  status: WalletStatus;
  accessError: string | null;
  connect: () => Promise<void>;
  refresh: () => Promise<void>;
  /** App-level sign-out: forces the sign-in gate until the user reconnects.
   *  Freighter stays authorized (it has no revoke API), which the UI states. */
  signOut: () => void;
}

/**
 * The employer wallet connection, owned once at the dashboard and shared down to
 * the create form (T-011) and stream list (T-012). Re-detects on window focus so
 * a mid-session network or account switch in Freighter is picked up; T-011 also
 * re-checks at submit time as a belt-and-suspenders guard.
 */
export function useWallet(): UseWallet {
  const [status, setStatus] = useState<WalletStatus>({ kind: "checking" });
  const [accessError, setAccessError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    // An app-level sign-out wins over whatever Freighter reports, so the gate
    // holds even when the extension is still authorized (and across the
    // window-focus re-resolve).
    if (isSignedOut()) {
      setStatus({ kind: "disconnected" });
      return;
    }
    setStatus(await resolveWalletStatus());
  }, []);

  const connect = useCallback(async (): Promise<void> => {
    setAccessError(null);
    clearSignedOut();
    try {
      setStatus(await connectWallet());
    } catch (error) {
      setAccessError(
        error instanceof WalletAccessError
          ? "Connection was declined. Try again when you are ready."
          : "Could not reach your wallet app. Make sure it is unlocked, then retry.",
      );
    }
  }, []);

  const signOut = useCallback((): void => {
    markSignedOut();
    setAccessError(null);
    setStatus({ kind: "disconnected" });
  }, []);

  useEffect(() => {
    void refresh();
    const onFocus = (): void => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  return { status, accessError, connect, refresh, signOut };
}
