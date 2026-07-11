import { useCallback, useEffect, useState } from "react";
import {
  connectWallet,
  resolveWalletStatus,
  WalletAccessError,
  type WalletStatus,
} from "../lib/wallet";

export interface UseWallet {
  status: WalletStatus;
  accessError: string | null;
  connect: () => Promise<void>;
  refresh: () => Promise<void>;
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
    setStatus(await resolveWalletStatus());
  }, []);

  const connect = useCallback(async (): Promise<void> => {
    setAccessError(null);
    try {
      setStatus(await connectWallet());
    } catch (error) {
      setAccessError(
        error instanceof WalletAccessError
          ? "Connection was declined. Try again when you are ready."
          : "Could not reach Freighter. Make sure it is unlocked, then retry.",
      );
    }
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

  return { status, accessError, connect, refresh };
}
