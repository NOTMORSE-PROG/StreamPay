import { useOutletContext } from "react-router-dom";
import type { DemoWallet, WalletLockState } from "../../lib/demoWallet";
import type { FundState } from "../../hooks/useDemoWallet";

// What the WorkerShell shares with its tab pages: the loaded demo wallet, its
// funding state, and (since T-043) the lock state. Pages derive the worker
// address from wallet.publicKey. Kept in a non-component module so the hook
// import never trips the react-refresh rule.

export interface WorkerContext {
  wallet: DemoWallet | null;
  fundState: FundState;
  retry: () => void;
  /** True when this browser reached the app with no wallet and no onboarding
   *  yet, so the index route should send them to the wizard. */
  firstRun: boolean;
  /** Where the wallet stands (none/legacy/locked/unlocked). The shell already
   *  swaps the page for the unlock screen when locked; pages use this for the
   *  set-up CTA and the Settings security card. */
  lockState: WalletLockState;
  /** Drop the decrypted key from memory now (Settings "Lock now"). */
  lock: () => void;
  /** Re-read the wallet and lock state after Settings changes it in place
   *  (set a PIN, change PIN). */
  refreshLockState: () => void;
}

export function useWorkerContext(): WorkerContext {
  return useOutletContext<WorkerContext>();
}
