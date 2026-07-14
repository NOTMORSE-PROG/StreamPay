// The employer's app-level sign-out flag (T-047). Freighter has no programmatic
// revoke, so "sign out" cannot sever the extension's authorization; instead the
// app records that the user chose to sign out and forces the sign-in gate until
// they reconnect. The copy in the UI says exactly this. localStorage (not
// sessionStorage) so the choice survives a new tab; a per-tab flag that silently
// reappeared in the next tab would read as broken. An in-memory fallback keeps
// it working in private mode for the current tab.

const KEY = "streampay:employer:signed-out";

let memoryFallback = false;

export function isSignedOut(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return memoryFallback;
  }
}

export function markSignedOut(): void {
  memoryFallback = true;
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // private mode: the in-memory fallback covers this tab
  }
}

export function clearSignedOut(): void {
  memoryFallback = false;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}
