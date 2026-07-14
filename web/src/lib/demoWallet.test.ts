// @vitest-environment node
// This module's keypair generation exercises the real ed25519 code path, which
// needs Node's crypto (jsdom's random source does not satisfy the SDK), and
// since T-041 the vault paths also need Node's crypto.subtle. Storage is the
// shared in-memory shim. The real browser path (WebCrypto + real localStorage)
// is proven live in the ticket evidence, not here.
import { beforeEach, describe, expect, it } from "vitest";
import {
  Keypair,
  TransactionBuilder,
  Account,
  BASE_FEE,
  Operation,
} from "@stellar/stellar-sdk";
import {
  changePin,
  clearDemoWallet,
  createWalletWithPin,
  exportSecret,
  exportSecretWithPin,
  getStoredPublicKey,
  getUnlockedWallet,
  getWalletLockState,
  hasStoredDemoWallet,
  importSecret,
  importSecretWithPin,
  loadOrCreateLegacyWallet,
  lockWallet,
  migrateLegacyToPin,
  unlockWallet,
} from "./demoWallet";
import { NETWORK_PASSPHRASE } from "./config";
import { MemoryStorage, installStorage } from "../test/memoryStorage";

const SECRET_KEY = "streampay:demo-wallet:secret";
const VAULT_KEY = "streampay:demo-wallet:vault";
const PIN = "123456";

beforeEach(() => {
  installStorage(new MemoryStorage());
  // Module-level session memory persists across tests in this file; every
  // test starts from a clean none state.
  clearDemoWallet();
});

describe("legacy wallet create / load / persist (pre-PIN behavior preserved)", () => {
  it("generates a valid testnet keypair on first load and persists it", () => {
    const wallet = loadOrCreateLegacyWallet();
    expect(wallet.publicKey).toMatch(/^G[A-Z2-7]{55}$/);
    expect(wallet.persisted).toBe(true);
    // The secret is persisted (never the public key) so the address is stable.
    const stored = localStorage.getItem(SECRET_KEY);
    expect(stored).toMatch(/^S[A-Z2-7]{55}$/);
    expect(Keypair.fromSecret(stored as string).publicKey()).toBe(
      wallet.publicKey,
    );
  });

  it("returns the SAME address on a second load (persistence)", () => {
    const first = loadOrCreateLegacyWallet();
    const second = loadOrCreateLegacyWallet();
    expect(second.publicKey).toBe(first.publicKey);
  });

  it("regenerates rather than crashing on a corrupt stored secret", () => {
    localStorage.setItem(SECRET_KEY, "not-a-real-secret");
    const wallet = loadOrCreateLegacyWallet();
    expect(wallet.publicKey).toMatch(/^G[A-Z2-7]{55}$/);
    // The corrupt entry was replaced with a valid one.
    expect(localStorage.getItem(SECRET_KEY)).toMatch(/^S[A-Z2-7]{55}$/);
  });

  it("reports persisted=false when localStorage writes throw (private mode)", () => {
    installStorage({
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
    });
    const wallet = loadOrCreateLegacyWallet();
    expect(wallet.publicKey).toMatch(/^G[A-Z2-7]{55}$/);
    expect(wallet.persisted).toBe(false);
  });

  it("hasStoredDemoWallet is false when storage reads throw", () => {
    installStorage({
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {},
      removeItem: () => {},
    });
    expect(hasStoredDemoWallet()).toBe(false);
  });

  it("exports the stored secret and imports a valid one (legacy backup/restore)", () => {
    loadOrCreateLegacyWallet();
    const secret = exportSecret();
    expect(secret).toBe(localStorage.getItem(SECRET_KEY));

    // Restore a DIFFERENT valid secret and confirm it replaces the stored one.
    const other = Keypair.random().secret();
    expect(importSecret(other)).toBe(true);
    expect(localStorage.getItem(SECRET_KEY)).toBe(other);
  });

  it("rejects an invalid secret on legacy import and changes nothing", () => {
    loadOrCreateLegacyWallet();
    const before = localStorage.getItem(SECRET_KEY);
    expect(importSecret("not-a-secret")).toBe(false);
    expect(localStorage.getItem(SECRET_KEY)).toBe(before);
  });
});

describe("lock-state machine", () => {
  it("walks none -> unlocked (create) -> locked (lock) -> unlocked (unlock)", async () => {
    expect(getWalletLockState()).toBe("none");
    expect(hasStoredDemoWallet()).toBe(false);

    const created = await createWalletWithPin(PIN);
    expect(getWalletLockState()).toBe("unlocked");
    expect(created.persisted).toBe(true);
    expect(hasStoredDemoWallet()).toBe(true);
    // No plaintext key: the only stored form is the vault envelope (the
    // envelope's ciphertext-only property is asserted in vault.test.ts).
    expect(localStorage.getItem(SECRET_KEY)).toBeNull();
    expect(localStorage.getItem(VAULT_KEY)).not.toBeNull();

    lockWallet();
    expect(getWalletLockState()).toBe("locked");
    expect(getUnlockedWallet()).toBeNull();
    // The address stays readable for display and funding while locked.
    expect(getStoredPublicKey()).toBe(created.publicKey);

    const unlocked = await unlockWallet(PIN);
    expect(unlocked.ok).toBe(true);
    if (unlocked.ok) {
      expect(unlocked.wallet.publicKey).toBe(created.publicKey);
    }
    expect(getWalletLockState()).toBe("unlocked");
  });

  it("reports legacy when only the plaintext key exists", () => {
    loadOrCreateLegacyWallet();
    expect(getWalletLockState()).toBe("legacy");
    expect(getUnlockedWallet()).not.toBeNull();
  });

  it("wrong PIN fails to unlock and stays locked", async () => {
    await createWalletWithPin(PIN);
    lockWallet();
    expect(await unlockWallet("654321")).toEqual({
      ok: false,
      reason: "wrong-pin",
    });
    expect(getWalletLockState()).toBe("locked");
  });

  it("a stale wallet handle refuses to sign after lockWallet", async () => {
    const wallet = await createWalletWithPin(PIN);
    const source = new Account(wallet.publicKey, "0");
    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.bumpSequence({ bumpTo: "1", source: wallet.publicKey }),
      )
      .setTimeout(30)
      .build();

    lockWallet();
    expect(() => wallet.signTransactionXdr(tx.toXDR())).toThrow(
      "wallet is locked",
    );
  });

  it("the vault wins over a leftover legacy key, and unlock self-heals it", async () => {
    // A crash between a migration's vault write and its legacy delete leaves
    // both custody forms; the vault is the truth.
    const wallet = await createWalletWithPin(PIN);
    localStorage.setItem(SECRET_KEY, Keypair.random().secret());
    lockWallet();
    expect(getWalletLockState()).toBe("locked");
    expect(getStoredPublicKey()).toBe(wallet.publicKey);

    const unlocked = await unlockWallet(PIN);
    expect(unlocked.ok).toBe(true);
    expect(localStorage.getItem(SECRET_KEY)).toBeNull();
  });

  it("clearDemoWallet clears both custody forms and the session", async () => {
    await createWalletWithPin(PIN);
    localStorage.setItem(SECRET_KEY, Keypair.random().secret());
    clearDemoWallet();
    expect(getWalletLockState()).toBe("none");
    expect(localStorage.getItem(SECRET_KEY)).toBeNull();
    expect(localStorage.getItem(VAULT_KEY)).toBeNull();
    expect(getStoredPublicKey()).toBeNull();
  });

  it("createWalletWithPin falls back to in-memory when storage throws", async () => {
    installStorage({
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
    });
    const wallet = await createWalletWithPin(PIN);
    expect(wallet.persisted).toBe(false);
    expect(getWalletLockState()).toBe("unlocked");
  });
});

describe("migration and PIN-authed backup/restore", () => {
  it("migrateLegacyToPin keeps the SAME address and removes the plaintext", async () => {
    const legacy = loadOrCreateLegacyWallet();
    expect(await migrateLegacyToPin(PIN)).toBe(true);
    expect(localStorage.getItem(SECRET_KEY)).toBeNull();
    expect(getWalletLockState()).toBe("unlocked");
    expect(getStoredPublicKey()).toBe(legacy.publicKey);

    lockWallet();
    const unlocked = await unlockWallet(PIN);
    expect(unlocked.ok && unlocked.wallet.publicKey === legacy.publicKey).toBe(
      true,
    );
  });

  it("migrateLegacyToPin with a failing vault write changes nothing", async () => {
    const memory = new MemoryStorage();
    installStorage(memory);
    const legacy = loadOrCreateLegacyWallet();
    const plaintext = memory.getItem(SECRET_KEY);

    // Reads keep working; only NEW writes (the vault envelope) fail.
    installStorage({
      getItem: (key: string) => memory.getItem(key),
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: (key: string) => memory.removeItem(key),
    });
    expect(await migrateLegacyToPin(PIN)).toBe(false);
    expect(memory.getItem(SECRET_KEY)).toBe(plaintext);

    installStorage(memory);
    expect(getWalletLockState()).toBe("legacy");
    expect(getStoredPublicKey()).toBe(legacy.publicKey);
  });

  it("migrateLegacyToPin without a legacy wallet returns false", async () => {
    expect(await migrateLegacyToPin(PIN)).toBe(false);
  });

  it("importSecretWithPin restores a wallet under a new PIN", async () => {
    const pair = Keypair.random();
    expect(await importSecretWithPin(` ${pair.secret()} `, PIN)).toBe(true);
    expect(getWalletLockState()).toBe("unlocked");
    expect(getStoredPublicKey()).toBe(pair.publicKey());
    expect(localStorage.getItem(SECRET_KEY)).toBeNull();
  });

  it("importSecretWithPin rejects an invalid secret and changes nothing", async () => {
    await createWalletWithPin(PIN);
    const before = localStorage.getItem(VAULT_KEY);
    expect(await importSecretWithPin("not-a-secret", "999999")).toBe(false);
    expect(localStorage.getItem(VAULT_KEY)).toBe(before);
  });

  it("exportSecretWithPin re-decrypts even while unlocked and nulls on a wrong PIN", async () => {
    const wallet = await createWalletWithPin(PIN);
    const secret = await exportSecretWithPin(PIN);
    expect(secret).toMatch(/^S[A-Z2-7]{55}$/);
    expect(Keypair.fromSecret(secret as string).publicKey()).toBe(
      wallet.publicKey,
    );
    expect(await exportSecretWithPin("000000")).toBeNull();
  });

  it("exportSecretWithPin returns the plaintext in the legacy world", async () => {
    loadOrCreateLegacyWallet();
    expect(await exportSecretWithPin("anything")).toBe(
      localStorage.getItem(SECRET_KEY),
    );
  });

  it("changePin swaps the working PIN", async () => {
    await createWalletWithPin(PIN);
    expect(await changePin(PIN, "999999")).toEqual({ ok: true });
    lockWallet();
    expect((await unlockWallet(PIN)).ok).toBe(false);
    expect((await unlockWallet("999999")).ok).toBe(true);
  });
});

describe("demoWallet signing", () => {
  it("signs a transaction so the signature verifies against the wallet key", () => {
    const wallet = loadOrCreateLegacyWallet();
    // Build a minimal valid transaction sourced by the demo wallet.
    const source = new Account(wallet.publicKey, "0");
    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.bumpSequence({ bumpTo: "1", source: wallet.publicKey }),
      )
      .setTimeout(30)
      .build();

    const signedXdr = wallet.signTransactionXdr(tx.toXDR());
    const signed = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
    expect(signed.signatures.length).toBe(1);

    // The signature must verify against the wallet's public key over the tx hash.
    const keypair = Keypair.fromPublicKey(wallet.publicKey);
    const ok = keypair.verify(signed.hash(), signed.signatures[0].signature());
    expect(ok).toBe(true);
  });

  it("signs after an unlock (the vault path produces a working signer)", async () => {
    await createWalletWithPin(PIN);
    lockWallet();
    const unlocked = await unlockWallet(PIN);
    expect(unlocked.ok).toBe(true);
    if (!unlocked.ok) return;
    const wallet = unlocked.wallet;

    const source = new Account(wallet.publicKey, "0");
    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.bumpSequence({ bumpTo: "1", source: wallet.publicKey }),
      )
      .setTimeout(30)
      .build();

    const signed = TransactionBuilder.fromXDR(
      wallet.signTransactionXdr(tx.toXDR()),
      NETWORK_PASSPHRASE,
    );
    const keypair = Keypair.fromPublicKey(wallet.publicKey);
    expect(
      keypair.verify(signed.hash(), signed.signatures[0].signature()),
    ).toBe(true);
  });
});
