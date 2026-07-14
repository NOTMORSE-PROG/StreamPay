// The employer's business display name (T-046), device-local, used to
// personalize the worker invite and the create-success handoff. No backend and
// no identity claim: the wallet is still the account; this is a label the
// employer sets for their own messages. Same storage hardening as the other
// profile libs.

const KEY = "streampay:employer:profile";

interface StoredEmployerProfile {
  v: 1;
  businessName: string;
}

export function getBusinessName(): string | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredEmployerProfile>;
    if (parsed.v !== 1 || typeof parsed.businessName !== "string") return null;
    const name = parsed.businessName.trim();
    return name === "" ? null : name;
  } catch {
    return null;
  }
}

/** Save the business name; an empty or whitespace name clears it. */
export function setBusinessName(name: string): void {
  const trimmed = name.trim();
  try {
    if (trimmed === "") {
      localStorage.removeItem(KEY);
    } else {
      const stored: StoredEmployerProfile = { v: 1, businessName: trimmed };
      localStorage.setItem(KEY, JSON.stringify(stored));
    }
  } catch {
    // private mode: does not persist
  }
}
