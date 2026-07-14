import { useCallback, useEffect, useRef, useState } from "react";
import {
  createWalletWithPin,
  getStoredPublicKey,
  getUnlockedWallet,
  getWalletLockState,
  loadOrCreateLegacyWallet,
  lockWallet,
  unlockWallet,
  type DemoWallet,
  type UnlockResult,
  type WalletLockState,
} from "../lib/demoWallet";
import { accountExists } from "../lib/contract";
import { friendbotUrl } from "../lib/config";

// The worker's demo wallet plus its friendbot funding state, shared by the
// shell, the Wallet tab, the onboarding wizard, and the stream detail. Since
// T-041 it also surfaces the lock state: a locked vault yields wallet=null
// while funding still runs against the stored public address (funding needs
// only the address, never the key).

export type FundState = "checking" | "funding" | "funded" | "failed";

export interface UseDemoWallet {
  wallet: DemoWallet | null;
  lockState: WalletLockState;
  fundState: FundState;
  /** Re-run the friendbot funding check (after a manual top-up, say). */
  retry: () => void;
  /** PIN-first creation (T-044 onboarding). Unlocked on return. */
  createWallet: (pin: string) => Promise<DemoWallet>;
  unlock: (pin: string) => Promise<UnlockResult>;
  lock: () => void;
  /** Re-read the module state (after migration or restore elsewhere). */
  refreshLockState: () => void;
}

export function useDemoWallet(): UseDemoWallet {
  const [wallet, setWallet] = useState<DemoWallet | null>(null);
  const [lockState, setLockState] =
    useState<WalletLockState>(getWalletLockState);
  const [fundState, setFundState] = useState<FundState>("checking");
  const fundedKeyRef = useRef<string | null>(null);

  const ensureFunded = useCallback(async (publicKey: string): Promise<void> => {
    setFundState("checking");
    if (await accountExists(publicKey)) {
      setFundState("funded");
      return;
    }
    setFundState("funding");
    try {
      const response = await fetch(friendbotUrl(publicKey));
      // Friendbot answers 400 if the account already exists; re-check the chain
      // rather than trusting the status, so a race still resolves to funded.
      if (response.ok || (await accountExists(publicKey))) {
        setFundState("funded");
      } else {
        setFundState("failed");
      }
    } catch {
      setFundState("failed");
    }
  }, []);

  useEffect(() => {
    const state = getWalletLockState();
    if (state === "legacy") {
      // Existing plaintext wallets keep working (they load their stored key);
      // the migration nudge (T-044) moves them into a vault. loadOrCreate only
      // creates when a legacy secret is absent, which cannot happen here.
      setWallet(loadOrCreateLegacyWallet());
    } else {
      // none: creation is explicit (onboarding PIN step, T-044), so leave the
      // wallet null and let the first-run gate route to the wizard.
      // locked: the shell shows the unlock screen. unlocked: use the session.
      setWallet(getUnlockedWallet());
    }
    setLockState(getWalletLockState());
  }, []);

  // Funding keys off the ADDRESS, which every custody form exposes without a
  // PIN, so a locked wallet still funds. Runs once per distinct address.
  useEffect(() => {
    const target = wallet?.publicKey ?? getStoredPublicKey();
    if (target === null || fundedKeyRef.current === target) {
      return;
    }
    fundedKeyRef.current = target;
    void ensureFunded(target);
  }, [wallet, lockState, ensureFunded]);

  const retry = useCallback(() => {
    const target = wallet?.publicKey ?? getStoredPublicKey();
    if (target !== null) {
      void ensureFunded(target);
    }
  }, [wallet, ensureFunded]);

  const createWallet = useCallback(async (pin: string): Promise<DemoWallet> => {
    const created = await createWalletWithPin(pin);
    setWallet(created);
    setLockState(getWalletLockState());
    return created;
  }, []);

  const unlock = useCallback(async (pin: string): Promise<UnlockResult> => {
    const result = await unlockWallet(pin);
    if (result.ok) {
      setWallet(result.wallet);
      setLockState(getWalletLockState());
    }
    return result;
  }, []);

  const lock = useCallback(() => {
    lockWallet();
    setWallet(null);
    setLockState(getWalletLockState());
  }, []);

  const refreshLockState = useCallback(() => {
    setLockState(getWalletLockState());
    setWallet(getUnlockedWallet());
  }, []);

  return {
    wallet,
    lockState,
    fundState,
    retry,
    createWallet,
    unlock,
    lock,
    refreshLockState,
  };
}
