// The worker's in-app demo wallet: a testnet-only Stellar keypair generated in
// the browser, clearly labeled demo scope (honest-scope rule; ENGINEERING.md
// decision 6). This is the SECOND signing boundary in the app (Freighter/
// wallet.ts is the employer's); the worker signs withdrawals (T-014) with the
// key held here. The secret never leaves this module except through the
// explicit backup exports, and is never logged.
//
// Since T-041 this module is a lock-state machine over two storage forms:
// - vault: the secret encrypted at rest under a PIN (lib/vault.ts, T-040)
// - legacy: the pre-PIN plaintext localStorage key, kept working so existing
//   demo wallets survive; T-044's migration nudge moves them into a vault
// A decrypted secret lives ONLY in the module-level session variable below,
// never in React state, storage, or props. Production replaces all of this
// with passkey onboarding (roadmap), which is why it stays one small module.

import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import { NETWORK_PASSPHRASE } from "./config";
import {
  clearVault,
  createVault,
  changeVaultPin,
  hasVault,
  openVault,
  readVaultPublicKey,
  type ChangePinResult,
} from "./vault";

const SECRET_KEY = "streampay:demo-wallet:secret";

export type WalletLockState = "none" | "legacy" | "locked" | "unlocked";

export type UnlockResult =
  | { ok: true; wallet: DemoWallet }
  | { ok: false; reason: "none" | "wrong-pin" | "corrupt" };

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

// The one place a decrypted (or in-memory-only) keypair lives for the session.
let sessionKeypair: Keypair | null = null;
let sessionPersisted = false;

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

function removeStoredSecret(): void {
  try {
    localStorage.removeItem(SECRET_KEY);
  } catch {
    // nothing persisted to clear
  }
}

/** Build the wallet handle for a SESSION keypair. The signer guard makes a
 *  stale handle refuse to sign after lockWallet(): a component that kept the
 *  object across a lock must not be able to bypass the lock. */
function sessionWallet(keypair: Keypair, persisted: boolean): DemoWallet {
  return {
    publicKey: keypair.publicKey(),
    persisted,
    signTransactionXdr(unsignedXdr: string): string {
      if (sessionKeypair !== keypair) {
        throw new Error("wallet is locked");
      }
      const tx = TransactionBuilder.fromXDR(unsignedXdr, NETWORK_PASSPHRASE);
      tx.sign(keypair);
      return tx.toXDR();
    },
  };
}

/** Build the wallet handle for the LEGACY plaintext keypair (no lock exists
 *  in that world, so no guard). */
function legacyWallet(keypair: Keypair, persisted: boolean): DemoWallet {
  return {
    publicKey: keypair.publicKey(),
    persisted,
    signTransactionXdr(unsignedXdr: string): string {
      const tx = TransactionBuilder.fromXDR(unsignedXdr, NETWORK_PASSPHRASE);
      tx.sign(keypair);
      return tx.toXDR();
    },
  };
}

/**
 * Where the wallet stands. Precedence: a session keypair means unlocked; else
 * a vault means locked (the vault wins over a leftover legacy key, see
 * unlockWallet's self-heal); else a legacy plaintext key; else nothing.
 */
export function getWalletLockState(): WalletLockState {
  if (sessionKeypair !== null) return "unlocked";
  if (hasVault()) return "locked";
  if (readStoredSecret() !== null) return "legacy";
  return "none";
}

/**
 * The pre-PIN load-or-create path, VERBATIM behavior of the old
 * loadOrCreateDemoWallet: load the plaintext key, or generate and persist one
 * (corrupt entries are replaced rather than crashing the screen). Kept so the
 * app behaves exactly as before until T-044 flips creation to PIN-first; the
 * migration nudge (T-044) moves these wallets into a vault.
 */
export function loadOrCreateLegacyWallet(): DemoWallet {
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
  return legacyWallet(keypair, persisted);
}

/**
 * Generate a fresh wallet whose secret is stored ONLY encrypted under the PIN
 * (T-044 onboarding). When the vault write fails (private mode) the wallet
 * falls back to in-memory-only with persisted=false, exactly like the legacy
 * path did; the UI warns. The session is unlocked either way.
 */
export async function createWalletWithPin(pin: string): Promise<DemoWallet> {
  const keypair = Keypair.random();
  const persisted = await createVault(keypair.secret(), pin);
  sessionKeypair = keypair;
  sessionPersisted = persisted;
  return sessionWallet(keypair, persisted);
}

/** Decrypt the vault into session memory. On success any leftover legacy
 *  plaintext key is removed (self-heal for a crash between a migration's
 *  vault write and its legacy delete: the vault, once open, is the truth). */
export async function unlockWallet(pin: string): Promise<UnlockResult> {
  const opened = await openVault(pin);
  if (!opened.ok) {
    return { ok: false, reason: opened.reason };
  }
  const keypair = Keypair.fromSecret(opened.secret);
  sessionKeypair = keypair;
  sessionPersisted = true;
  removeStoredSecret();
  return { ok: true, wallet: sessionWallet(keypair, true) };
}

/** Drop the decrypted key from memory. Stale wallet handles refuse to sign
 *  from this moment (see sessionWallet's guard). */
export function lockWallet(): void {
  sessionKeypair = null;
  sessionPersisted = false;
}

/** The current usable wallet without prompting: the unlocked session wallet,
 *  or the legacy plaintext wallet (that world has no lock). Null when locked,
 *  absent, or the legacy entry is corrupt (loadOrCreateLegacyWallet is the
 *  path that repairs corruption, deliberately, since it regenerates). */
export function getUnlockedWallet(): DemoWallet | null {
  if (sessionKeypair !== null) {
    return sessionWallet(sessionKeypair, sessionPersisted);
  }
  if (hasVault()) return null;
  const stored = readStoredSecret();
  if (stored === null) return null;
  try {
    return legacyWallet(Keypair.fromSecret(stored), true);
  } catch {
    return null;
  }
}

/**
 * The wallet's public address from ANY custody form, without a PIN: session
 * memory, the vault envelope (plaintext by design), or derived from the legacy
 * key. Lets the locked app still display the address and poll friendbot
 * funding. Null only when no wallet exists at all.
 */
export function getStoredPublicKey(): string | null {
  if (sessionKeypair !== null) return sessionKeypair.publicKey();
  const fromVault = readVaultPublicKey();
  if (fromVault !== null) return fromVault;
  const stored = readStoredSecret();
  if (stored === null) return null;
  try {
    return Keypair.fromSecret(stored).publicKey();
  } catch {
    return null;
  }
}

/**
 * Encrypt the EXISTING legacy plaintext wallet under a PIN (T-044's migration
 * nudge). The plaintext key is deleted ONLY after the vault write is confirmed
 * present and parseable, so a failed write changes nothing and the wallet is
 * never lost mid-migration. The session ends up unlocked with the same key.
 */
export async function migrateLegacyToPin(pin: string): Promise<boolean> {
  const stored = readStoredSecret();
  if (stored === null) return false;
  let keypair: Keypair;
  try {
    keypair = Keypair.fromSecret(stored);
  } catch {
    return false;
  }
  const written = await createVault(stored, pin);
  if (!written || readVaultPublicKey() !== keypair.publicKey()) {
    return false;
  }
  removeStoredSecret();
  sessionKeypair = keypair;
  sessionPersisted = true;
  return true;
}

/**
 * Restore a wallet from a pasted secret under a NEW PIN (T-044 backup/restore
 * and the forgot-PIN path). Validates the secret FIRST; on any failure nothing
 * changes, so a typo never wipes an existing wallet. On success the restored
 * wallet replaces both custody forms and the session is unlocked.
 */
export async function importSecretWithPin(
  secret: string,
  pin: string,
): Promise<boolean> {
  const trimmed = secret.trim();
  let keypair: Keypair;
  try {
    keypair = Keypair.fromSecret(trimmed);
  } catch {
    return false;
  }
  const written = await createVault(trimmed, pin);
  if (!written) return false;
  removeStoredSecret();
  sessionKeypair = keypair;
  sessionPersisted = true;
  return true;
}

/**
 * The secret for the backup flow, ALWAYS re-decrypted from the vault so the
 * reveal is PIN re-authed even while the session is unlocked. The legacy world
 * has no PIN, so it returns the plaintext as before (T-044 migrates it). Null
 * on a wrong PIN or when nothing is stored.
 */
export async function exportSecretWithPin(pin: string): Promise<string | null> {
  if (hasVault()) {
    const opened = await openVault(pin);
    return opened.ok ? opened.secret : null;
  }
  return readStoredSecret();
}

/** Re-encrypt the vault under a new PIN (Settings). */
export async function changePin(
  currentPin: string,
  newPin: string,
): Promise<ChangePinResult> {
  return changeVaultPin(currentPin, newPin);
}

/**
 * Whether this browser already holds a demo wallet in EITHER custody form.
 * The worker first-run gate keys off this (WorkerShell), so a vault holder is
 * never bounced back to onboarding, even while locked.
 */
export function hasStoredDemoWallet(): boolean {
  return hasVault() || readStoredSecret() !== null;
}

/**
 * The stored LEGACY secret, for the pre-PIN backup flow (T-044 replaces this
 * UI with the PIN re-authed exportSecretWithPin). Returns null when the wallet
 * lives in a vault: the plaintext is not readable without the PIN.
 */
export function exportSecret(): string | null {
  return readStoredSecret();
}

/**
 * Restore a demo wallet from a pasted secret, pre-PIN path (T-044 replaces
 * this UI with importSecretWithPin). Validates before persisting; returns
 * false (and stores nothing) on an invalid key.
 */
export function importSecret(secret: string): boolean {
  const trimmed = secret.trim();
  try {
    Keypair.fromSecret(trimmed);
  } catch {
    return false;
  }
  return writeStoredSecret(trimmed);
}

/** Wipe every custody form and the session (forgot-PIN and log-out paths). */
export function clearDemoWallet(): void {
  lockWallet();
  clearVault();
  removeStoredSecret();
}
