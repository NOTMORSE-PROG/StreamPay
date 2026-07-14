// Auto-lock preference for the worker PIN lock (T-043): one on/off toggle,
// default ON. The shell locks the wallet after the app has been hidden for
// AUTO_LOCK_HIDDEN_MS; deliberately NO idle-while-visible lock, so the ticking
// balance demo is never interrupted on screen.

const AUTOLOCK_KEY = "streampay:worker:autolock";

/** Lock after 5 minutes hidden (backgrounded tab or PWA). */
export const AUTO_LOCK_HIDDEN_MS = 5 * 60_000;

export function isAutoLockEnabled(): boolean {
  try {
    return localStorage.getItem(AUTOLOCK_KEY) !== "off";
  } catch {
    return true; // storage unavailable: fail toward locking
  }
}

export function setAutoLockEnabled(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.removeItem(AUTOLOCK_KEY);
    } else {
      localStorage.setItem(AUTOLOCK_KEY, "off");
    }
  } catch {
    // private mode: the preference simply does not persist
  }
}
