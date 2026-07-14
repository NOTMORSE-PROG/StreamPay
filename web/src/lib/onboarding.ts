// Whether the worker has been through onboarding, so the first-run gate only sends
// a genuinely new visitor to the wizard. Backed by localStorage, but with an
// in-memory session flag too: in private mode storage throws and would never
// persist, so once the worker finishes or skips the wizard this session, the gate
// must not loop them back into it.

const ONBOARDED_KEY = "streampay:worker:onboarded";

let sessionComplete = false;

/** True once the worker has finished or skipped onboarding (persisted or session). */
export function isOnboarded(): boolean {
  if (sessionComplete) {
    return true;
  }
  try {
    return localStorage.getItem(ONBOARDED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Mark onboarding done for this session and, if possible, persistently. */
export function markOnboarded(): void {
  sessionComplete = true;
  try {
    localStorage.setItem(ONBOARDED_KEY, "1");
  } catch {
    // Private mode: the session flag above still stops the redirect loop.
  }
}

/** Reset onboarding (test/support only; not wired into the UI). */
export function resetOnboarding(): void {
  sessionComplete = false;
  try {
    localStorage.removeItem(ONBOARDED_KEY);
  } catch {
    // nothing persisted to clear
  }
}
