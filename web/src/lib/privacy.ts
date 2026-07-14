// Balance privacy toggle (T-048): the standard fintech eye control so a worker
// can open the app in public without broadcasting their pay. Home-only for v1;
// the StreamDetail ticking hero stays visible (it is the demo's money shot).
// Device-local, storage-hardened like the other preference libs.

const KEY = "streampay:worker:privacy";

/** The mask shown in place of a hidden amount. */
export const HIDDEN_MASK = "••••";

export function isPrivacyOn(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setPrivacyOn(on: boolean): void {
  try {
    if (on) {
      localStorage.setItem(KEY, "1");
    } else {
      localStorage.removeItem(KEY);
    }
  } catch {
    // private mode: does not persist
  }
}

/** The value when visible, or the mask when privacy is on. */
export function hiddenOr(value: string, on: boolean): string {
  return on ? HIDDEN_MASK : value;
}
