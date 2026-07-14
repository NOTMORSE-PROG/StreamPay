// Minimal in-memory localStorage for node-environment suites (demoWallet,
// vault): those modules run in the node environment because they exercise the
// SDK's ed25519 and WebCrypto paths that jsdom cannot satisfy, and this shim is
// all of the Storage surface they touch.

export class MemoryStorage {
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
  get length(): number {
    return this.store.size;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  keys(): string[] {
    return Array.from(this.store.keys());
  }
}

export function installStorage(storage: unknown): void {
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  });
}
