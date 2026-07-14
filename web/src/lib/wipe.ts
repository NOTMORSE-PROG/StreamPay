// Erase every StreamPay trace from this browser (T-045, the shared-device
// answer from GAP-ANALYSIS 2a). Prefix-based so it always covers new keys:
// wallet vault, profile, receipts, currency, onboarding, auto-lock, employer
// labels, and anything future under the streampay: namespace. The money itself
// lives on the Stellar network and is unaffected; only local state is removed.

const PREFIX = "streampay:";

export function wipeWorkerDevice(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key !== null && key.startsWith(PREFIX)) {
        keys.push(key);
      }
    }
    for (const key of keys) {
      localStorage.removeItem(key);
    }
  } catch {
    // private mode or storage disabled: nothing persisted to wipe
  }
}
