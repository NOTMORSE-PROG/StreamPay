// PIN-encrypted vault for the worker's demo-wallet secret (T-040). Replaces
// the plaintext localStorage custody flagged in GAP-ANALYSIS 2a: the secret is
// stored only as an AES-GCM ciphertext under a key derived from the user's PIN.
// Honesty boundary: there is no server, so nothing rate-limits an attacker who
// copies the envelope; a 6-digit PIN is offline-brute-forceable at PBKDF2 speed.
// The UI copy must claim convenience-grade protection only; the production
// answer stays passkeys (roadmap item 1). This module is pure crypto + storage:
// no React, no chain, and it never holds a decrypted secret beyond the call
// that returns it (session custody belongs to demoWallet.ts, the signing
// boundary).

import { Keypair } from "@stellar/stellar-sdk";

const VAULT_KEY = "streampay:demo-wallet:vault";

// OWASP Password Storage Cheat Sheet recommendation for PBKDF2-HMAC-SHA256
// (verified 2026-07-13). Stored per-envelope so a future bump still opens old
// vaults; overridable only so tests stay fast.
export const DEFAULT_ITERATIONS = 600_000;

const KDF_NAME = "PBKDF2-SHA256";
const SALT_BYTES = 16;
// 96-bit IV per NIST SP 800-38D; GCM security depends on never reusing an IV
// under the same key, so every write derives a fresh salt (fresh key) AND a
// fresh IV.
const IV_BYTES = 12;

interface VaultEnvelope {
  v: 1;
  /** The wallet's G... address, plaintext BY DESIGN: it is public, and the
   *  locked app still needs it to display the address and poll funding. It
   *  also lets openVault verify a decrypt produced the matching keypair. */
  publicKey: string;
  kdf: typeof KDF_NAME;
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

export type OpenVaultResult =
  | { ok: true; secret: string }
  | { ok: false; reason: "none" | "wrong-pin" | "corrupt" };

export type ChangePinResult =
  | { ok: true }
  | { ok: false; reason: "none" | "wrong-pin" | "corrupt" | "write-failed" };

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveAesKey(
  pin: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(VAULT_KEY);
  } catch {
    return null; // private mode / storage disabled
  }
}

/** Parse and shape-check the stored envelope. Unknown versions and malformed
 *  entries are "corrupt": the caller decides, this module NEVER regenerates or
 *  deletes on its own (a corrupt vault may still be someone's only key copy). */
function parseEnvelope(raw: string): VaultEnvelope | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const env = value as Record<string, unknown>;
  if (
    env.v !== 1 ||
    env.kdf !== KDF_NAME ||
    typeof env.publicKey !== "string" ||
    typeof env.iterations !== "number" ||
    !Number.isInteger(env.iterations) ||
    env.iterations <= 0 ||
    typeof env.salt !== "string" ||
    typeof env.iv !== "string" ||
    typeof env.ciphertext !== "string"
  ) {
    return null;
  }
  return env as unknown as VaultEnvelope;
}

/** Whether an envelope exists at all (even a corrupt one counts: the first-run
 *  gate must never bounce a vault holder to onboarding). */
export function hasVault(): boolean {
  return readRaw() !== null;
}

/** The vault's public address without any PIN, for the locked app's display
 *  and funding polls. Null when absent or unparseable. */
export function readVaultPublicKey(): string | null {
  const raw = readRaw();
  if (raw === null) return null;
  return parseEnvelope(raw)?.publicKey ?? null;
}

/**
 * Encrypt the secret under the PIN and persist the envelope. Returns false when
 * the storage write throws (private mode) or the secret is not a valid Stellar
 * secret; nothing is written in either case. Fresh salt and IV every call.
 */
export async function createVault(
  secret: string,
  pin: string,
  opts?: { iterations?: number },
): Promise<boolean> {
  let publicKey: string;
  try {
    publicKey = Keypair.fromSecret(secret).publicKey();
  } catch {
    return false;
  }
  const iterations = opts?.iterations ?? DEFAULT_ITERATIONS;
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveAesKey(pin, salt, iterations);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    new TextEncoder().encode(secret),
  );
  const envelope: VaultEnvelope = {
    v: 1,
    publicKey,
    kdf: KDF_NAME,
    iterations,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
  try {
    localStorage.setItem(VAULT_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

/**
 * Decrypt the secret with the PIN. "wrong-pin" is a GCM auth failure, which is
 * indistinguishable from tampered ciphertext by construction; "corrupt" is a
 * malformed envelope or a decrypt whose keypair does not match the envelope's
 * publicKey.
 */
export async function openVault(pin: string): Promise<OpenVaultResult> {
  const raw = readRaw();
  if (raw === null) return { ok: false, reason: "none" };
  const envelope = parseEnvelope(raw);
  if (envelope === null) return { ok: false, reason: "corrupt" };

  let decrypted: ArrayBuffer;
  try {
    const key = await deriveAesKey(
      pin,
      fromBase64(envelope.salt),
      envelope.iterations,
    );
    decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(envelope.iv) as BufferSource },
      key,
      fromBase64(envelope.ciphertext) as BufferSource,
    );
  } catch {
    return { ok: false, reason: "wrong-pin" };
  }

  const secret = new TextDecoder().decode(decrypted);
  try {
    if (Keypair.fromSecret(secret).publicKey() !== envelope.publicKey) {
      return { ok: false, reason: "corrupt" };
    }
  } catch {
    return { ok: false, reason: "corrupt" };
  }
  return { ok: true, secret };
}

/** Re-encrypt under a new PIN (fresh salt and IV). The current PIN must open
 *  the vault first; on any failure the stored envelope is left untouched. */
export async function changeVaultPin(
  currentPin: string,
  newPin: string,
  opts?: { iterations?: number },
): Promise<ChangePinResult> {
  const opened = await openVault(currentPin);
  if (!opened.ok) return { ok: false, reason: opened.reason };
  const written = await createVault(opened.secret, newPin, opts);
  return written ? { ok: true } : { ok: false, reason: "write-failed" };
}

export function clearVault(): void {
  try {
    localStorage.removeItem(VAULT_KEY);
  } catch {
    // nothing persisted to clear
  }
}
