// The worker's local profile (T-042): a display name for the greeting, the
// avatar chip, and the share text. Purely cosmetic and device-local, never
// sent anywhere: identity stays the wallet (locked decision), this is a label
// on top. Same storage hardening as every lib here: private mode degrades to
// non-persistent, corrupt entries read as absent.

const PROFILE_KEY = "streampay:worker:profile";

export interface WorkerProfile {
  name: string;
}

interface StoredProfile {
  v: 1;
  name: string;
}

export function getWorkerProfile(): WorkerProfile | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(PROFILE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredProfile>;
    if (parsed.v !== 1 || typeof parsed.name !== "string") return null;
    const name = parsed.name.trim();
    return name === "" ? null : { name };
  } catch {
    return null;
  }
}

/** Save the display name; an empty or whitespace name clears the profile. */
export function setWorkerName(name: string): void {
  const trimmed = name.trim();
  try {
    if (trimmed === "") {
      localStorage.removeItem(PROFILE_KEY);
    } else {
      const stored: StoredProfile = { v: 1, name: trimmed };
      localStorage.setItem(PROFILE_KEY, JSON.stringify(stored));
    }
  } catch {
    // private mode: the name simply does not persist
  }
}

/** The avatar chip letter: the name's first grapheme (so a non-ASCII or emoji
 *  name still yields one visible character), uppercased. */
export function avatarInitial(name: string): string {
  const trimmed = name.trim();
  if (trimmed === "") return "";
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, {
      granularity: "grapheme",
    });
    const first = segmenter.segment(trimmed)[Symbol.iterator]().next();
    if (!first.done) return first.value.segment.toLocaleUpperCase();
  }
  return [...trimmed][0].toLocaleUpperCase();
}

/** The share text for handing the address to an employer, weaving the display
 *  name in when one is set and reading cleanly when not. */
export function shareAddressText(publicKey: string): string {
  const profile = getWorkerProfile();
  const intro =
    profile === null
      ? "Pay me with StreamPay."
      : `Pay me with StreamPay. I am ${profile.name}.`;
  return `${intro} My wallet address: ${publicKey}`;
}
