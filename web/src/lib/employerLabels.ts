import { StrKey } from "@stellar/stellar-sdk";

// Worker-side petnames for employers (T-049): the mirror of the employer's
// address book. A stream card that says "from Acme Co" instead of a bare G...
// address. Device-local, validated like the address book: a single JSON map
// keyed by employer address, invalid keys dropped on read.

const KEY = "streampay:worker:employer-labels";

interface StoredLabels {
  v: 1;
  labels: Record<string, string>;
}

function isValidAddress(address: string): boolean {
  try {
    return StrKey.isValidEd25519PublicKey(address);
  } catch {
    return false;
  }
}

export function getAllEmployerLabels(): Record<string, string> {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return {};
  }
  if (raw === null) return {};
  try {
    const parsed = JSON.parse(raw) as Partial<StoredLabels>;
    if (
      parsed.v !== 1 ||
      typeof parsed.labels !== "object" ||
      parsed.labels === null
    ) {
      return {};
    }
    const clean: Record<string, string> = {};
    for (const [address, name] of Object.entries(parsed.labels)) {
      if (
        isValidAddress(address) &&
        typeof name === "string" &&
        name.trim() !== ""
      ) {
        clean[address] = name;
      }
    }
    return clean;
  } catch {
    return {};
  }
}

export function getEmployerLabel(address: string): string | null {
  return getAllEmployerLabels()[address] ?? null;
}

/** Set (or clear, with an empty name) the label for an employer address. */
export function setEmployerLabel(address: string, name: string): void {
  if (!isValidAddress(address)) return;
  const labels = getAllEmployerLabels();
  const trimmed = name.trim();
  if (trimmed === "") {
    delete labels[address];
  } else {
    labels[address] = trimmed;
  }
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, labels }));
  } catch {
    // private mode: does not persist
  }
}
