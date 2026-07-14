// @vitest-environment node
// The vault exercises WebCrypto (PBKDF2 + AES-GCM) and the SDK's ed25519 path,
// both of which need Node's crypto (jsdom provides neither subtle nor a random
// source the SDK accepts). Storage is the shared in-memory shim. Fast KDF
// iterations via the test-only override; one test pins the production default.
import { beforeEach, describe, expect, it } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import { MemoryStorage, installStorage } from "../test/memoryStorage";
import {
  DEFAULT_ITERATIONS,
  changeVaultPin,
  clearVault,
  createVault,
  hasVault,
  openVault,
  readVaultPublicKey,
} from "./vault";

const VAULT_KEY = "streampay:demo-wallet:vault";
const FAST = { iterations: 1_000 };
const PIN = "123456";

function storedEnvelope(): Record<string, unknown> {
  return JSON.parse(localStorage.getItem(VAULT_KEY) as string) as Record<
    string,
    unknown
  >;
}

describe("vault create / open", () => {
  beforeEach(() => {
    installStorage(new MemoryStorage());
  });

  it("roundtrips: createVault then openVault returns the same secret", async () => {
    const secret = Keypair.random().secret();
    expect(await createVault(secret, PIN, FAST)).toBe(true);
    expect(hasVault()).toBe(true);
    const opened = await openVault(PIN);
    expect(opened).toEqual({ ok: true, secret });
  });

  it("stores no plaintext secret, only the envelope with the public address", async () => {
    const pair = Keypair.random();
    await createVault(pair.secret(), PIN, FAST);
    const raw = localStorage.getItem(VAULT_KEY) as string;
    expect(raw).not.toContain(pair.secret());
    const env = storedEnvelope();
    expect(env.publicKey).toBe(pair.publicKey());
    expect(env.kdf).toBe("PBKDF2-SHA256");
    expect(readVaultPublicKey()).toBe(pair.publicKey());
  });

  it("records the OWASP default iteration count when no override is given", async () => {
    await createVault(Keypair.random().secret(), PIN);
    expect(storedEnvelope().iterations).toBe(DEFAULT_ITERATIONS);
    expect(DEFAULT_ITERATIONS).toBe(600_000);
  });

  it("rejects an invalid secret and writes nothing", async () => {
    expect(await createVault("not-a-secret", PIN, FAST)).toBe(false);
    expect(hasVault()).toBe(false);
  });

  it("returns false when the storage write throws (private mode)", async () => {
    installStorage({
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
    });
    expect(await createVault(Keypair.random().secret(), PIN, FAST)).toBe(false);
  });

  it("wrong PIN opens as wrong-pin", async () => {
    await createVault(Keypair.random().secret(), PIN, FAST);
    expect(await openVault("654321")).toEqual({
      ok: false,
      reason: "wrong-pin",
    });
  });

  it("a tampered ciphertext byte opens as wrong-pin (GCM auth failure)", async () => {
    await createVault(Keypair.random().secret(), PIN, FAST);
    const env = storedEnvelope();
    const bytes = Uint8Array.from(atob(env.ciphertext as string), (c) =>
      c.charCodeAt(0),
    );
    bytes[0] ^= 0xff;
    env.ciphertext = btoa(String.fromCharCode(...bytes));
    localStorage.setItem(VAULT_KEY, JSON.stringify(env));
    expect(await openVault(PIN)).toEqual({ ok: false, reason: "wrong-pin" });
  });

  it("no vault opens as none", async () => {
    expect(await openVault(PIN)).toEqual({ ok: false, reason: "none" });
  });

  it.each([
    ["not JSON", "{{{"],
    ["unknown version", JSON.stringify({ v: 2 })],
    [
      "missing field",
      JSON.stringify({
        v: 1,
        kdf: "PBKDF2-SHA256",
        publicKey: "G...",
        iterations: 1000,
        salt: "AA==",
        // iv and ciphertext missing
      }),
    ],
  ])(
    "a %s envelope opens as corrupt and is never regenerated",
    async (_label, raw) => {
      localStorage.setItem(VAULT_KEY, raw);
      expect(await openVault(PIN)).toEqual({ ok: false, reason: "corrupt" });
      // Still present: destructive choices belong to the forgot-PIN UI, not here.
      expect(localStorage.getItem(VAULT_KEY)).toBe(raw);
      expect(hasVault()).toBe(true);
    },
  );

  it("a decrypt whose keypair mismatches the envelope publicKey is corrupt", async () => {
    await createVault(Keypair.random().secret(), PIN, FAST);
    const env = storedEnvelope();
    env.publicKey = Keypair.random().publicKey();
    localStorage.setItem(VAULT_KEY, JSON.stringify(env));
    expect(await openVault(PIN)).toEqual({ ok: false, reason: "corrupt" });
  });

  it("clearVault removes the envelope", async () => {
    await createVault(Keypair.random().secret(), PIN, FAST);
    clearVault();
    expect(hasVault()).toBe(false);
    expect(readVaultPublicKey()).toBeNull();
  });
});

describe("vault changeVaultPin", () => {
  beforeEach(() => {
    installStorage(new MemoryStorage());
  });

  it("re-encrypts with a fresh salt and iv; the old PIN stops working", async () => {
    const secret = Keypair.random().secret();
    await createVault(secret, PIN, FAST);
    const before = storedEnvelope();

    expect(await changeVaultPin(PIN, "999999", FAST)).toEqual({ ok: true });
    const after = storedEnvelope();
    expect(after.salt).not.toBe(before.salt);
    expect(after.iv).not.toBe(before.iv);
    expect(after.ciphertext).not.toBe(before.ciphertext);

    expect(await openVault(PIN)).toEqual({ ok: false, reason: "wrong-pin" });
    expect(await openVault("999999")).toEqual({ ok: true, secret });
  });

  it("wrong current PIN changes nothing", async () => {
    await createVault(Keypair.random().secret(), PIN, FAST);
    const before = localStorage.getItem(VAULT_KEY);
    expect(await changeVaultPin("000000", "999999", FAST)).toEqual({
      ok: false,
      reason: "wrong-pin",
    });
    expect(localStorage.getItem(VAULT_KEY)).toBe(before);
  });
});
