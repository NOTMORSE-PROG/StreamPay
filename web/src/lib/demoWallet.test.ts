// @vitest-environment node
// This module's keypair generation exercises the real ed25519 code path, which
// needs Node's crypto (jsdom's random source does not satisfy the SDK). We run in
// the node environment and shim a minimal in-memory localStorage, which is all
// demoWallet touches. The real browser path (WebCrypto + real localStorage) is
// proven live in T-023's evidence, not here.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  Keypair,
  TransactionBuilder,
  Account,
  BASE_FEE,
  Operation,
} from "@stellar/stellar-sdk";
import { clearDemoWallet, loadOrCreateDemoWallet } from "./demoWallet";
import { NETWORK_PASSPHRASE } from "./config";

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

function installStorage(storage: unknown): void {
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  });
}

const SECRET_KEY = "streampay:demo-wallet:secret";

describe("demoWallet create / load / persist", () => {
  beforeEach(() => {
    installStorage(new MemoryStorage());
  });
  afterEach(() => {
    installStorage(new MemoryStorage());
  });

  it("generates a valid testnet keypair on first load and persists it", () => {
    const wallet = loadOrCreateDemoWallet();
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
    const first = loadOrCreateDemoWallet();
    const second = loadOrCreateDemoWallet();
    expect(second.publicKey).toBe(first.publicKey);
  });

  it("regenerates rather than crashing on a corrupt stored secret", () => {
    localStorage.setItem(SECRET_KEY, "not-a-real-secret");
    const wallet = loadOrCreateDemoWallet();
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
    const wallet = loadOrCreateDemoWallet();
    expect(wallet.publicKey).toMatch(/^G[A-Z2-7]{55}$/);
    expect(wallet.persisted).toBe(false);
  });

  it("clearDemoWallet removes the stored key", () => {
    loadOrCreateDemoWallet();
    expect(localStorage.getItem(SECRET_KEY)).not.toBeNull();
    clearDemoWallet();
    expect(localStorage.getItem(SECRET_KEY)).toBeNull();
  });
});

describe("demoWallet signing", () => {
  beforeEach(() => {
    installStorage(new MemoryStorage());
  });
  afterEach(() => {
    installStorage(new MemoryStorage());
  });

  it("signs a transaction so the signature verifies against the wallet key", () => {
    const wallet = loadOrCreateDemoWallet();
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
});
