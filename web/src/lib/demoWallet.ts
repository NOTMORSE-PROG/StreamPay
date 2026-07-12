// The worker's in-app demo wallet: a testnet-only Stellar keypair generated in
// the browser and kept in localStorage, clearly labeled demo scope (honest-scope
// rule; ENGINEERING.md decision 6). This is the SECOND signing boundary in the
// app (Freighter/wallet.ts is the employer's); the worker signs withdrawals
// (T-014) with the key held here. The secret never leaves this module and is
// never logged. Production replaces this with passkey onboarding (roadmap), which
// is exactly why it is fenced behind one small module.

import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import { NETWORK_PASSPHRASE } from "./config";

const SECRET_KEY = "streampay:demo-wallet:secret";

export interface DemoWallet {
  /** The G... address to hand to the employer and to receive wages. */
  publicKey: string;
  /** False when localStorage is unavailable (private mode): the key is
   *  in-memory only for this session and would be lost on reload, orphaning any
   *  earned wages. The UI warns before that can happen. */
  persisted: boolean;
  /** Sign a prepared transaction XDR with the worker key (used by the withdraw
   *  path in T-014). The worker account is the transaction source, so this
   *  signature satisfies the contract's require_auth(worker). Returns signed XDR. */
  signTransactionXdr(unsignedXdr: string): string;
}

function readStoredSecret(): string | null {
  try {
    return localStorage.getItem(SECRET_KEY);
  } catch {
    return null; // private mode / storage disabled
  }
}

function writeStoredSecret(secret: string): boolean {
  try {
    localStorage.setItem(SECRET_KEY, secret);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load the persisted demo wallet, or generate and persist a new one on first
 * visit. The SAME address returns on every later visit in the same browser
 * (persistence), so a worker keeps one address and one earnings history. A
 * corrupt or unreadable stored secret is replaced with a fresh keypair rather
 * than crashing the screen.
 */
export function loadOrCreateDemoWallet(): DemoWallet {
  const stored = readStoredSecret();
  let keypair: Keypair | null = null;
  if (stored !== null) {
    try {
      keypair = Keypair.fromSecret(stored);
    } catch {
      keypair = null; // corrupt entry; regenerate below
    }
  }

  let persisted = stored !== null && keypair !== null;
  if (keypair === null) {
    keypair = Keypair.random();
    persisted = writeStoredSecret(keypair.secret());
  }

  const signer = keypair;
  return {
    publicKey: signer.publicKey(),
    persisted,
    signTransactionXdr(unsignedXdr: string): string {
      const tx = TransactionBuilder.fromXDR(unsignedXdr, NETWORK_PASSPHRASE);
      tx.sign(signer);
      return tx.toXDR();
    },
  };
}

/** Wipe the stored demo wallet (test/support only; not wired into the UI). */
export function clearDemoWallet(): void {
  try {
    localStorage.removeItem(SECRET_KEY);
  } catch {
    // nothing persisted to clear
  }
}
