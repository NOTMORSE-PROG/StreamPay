import { StrKey } from "@stellar/stellar-sdk";

// The employer's saved workers (name + address), kept in localStorage so repeat
// streams to the same person are a two-click pick instead of a paste. This is the
// client-side stand-in for the competitors' payroll employee list (we have no
// backend by design). Entries with an invalid address are dropped on read.

const KEY = "streampay:workers";

export interface SavedWorker {
  name: string;
  address: string;
}

function isValidAddress(address: string): boolean {
  try {
    return StrKey.isValidEd25519PublicKey(address);
  } catch {
    return false;
  }
}

/** All saved workers, newest first; [] on none or corrupt data. */
export function getSavedWorkers(): SavedWorker[] {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return [];
  }
  if (raw === null) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is SavedWorker =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as SavedWorker).name === "string" &&
        typeof (item as SavedWorker).address === "string" &&
        isValidAddress((item as SavedWorker).address),
    );
  } catch {
    return [];
  }
}

/**
 * Save (or update, by address) a worker and return the new list, newest first.
 * A blank name or invalid address is ignored so the picker never shows junk.
 */
export function saveWorker(name: string, address: string): SavedWorker[] {
  const trimmedName = name.trim();
  if (trimmedName === "" || !isValidAddress(address)) {
    return getSavedWorkers();
  }
  const others = getSavedWorkers().filter((w) => w.address !== address);
  const next = [{ name: trimmedName, address }, ...others];
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // private mode: the entry stays for this session via the returned list
  }
  return next;
}

/** Remove a saved worker by address; returns the updated list. */
export function removeWorker(address: string): SavedWorker[] {
  const next = getSavedWorkers().filter((w) => w.address !== address);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // nothing to persist
  }
  return next;
}
