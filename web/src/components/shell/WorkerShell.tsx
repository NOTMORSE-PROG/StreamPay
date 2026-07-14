import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useDemoWallet } from "../../hooks/useDemoWallet";
import { hasStoredDemoWallet } from "../../lib/demoWallet";
import { hasVault } from "../../lib/vault";
import { AUTO_LOCK_HIDDEN_MS, isAutoLockEnabled } from "../../lib/autolock";
import { isOnboarded } from "../../lib/onboarding";
import { avatarInitial, getWorkerProfile } from "../../lib/profile";
import { BrandMark } from "../ui/BrandMark";
import { TestnetBadge } from "../ui/TestnetBadge";
import { cx } from "../ui/cx";
import { UnlockScreen } from "../worker/UnlockScreen";
import type { WorkerContext } from "../worker/context";

// The worker app chrome: a phone-width column with a compact top bar and a sticky
// bottom tab bar (Home, Activity, Wallet, Settings), so the worker side reads and
// behaves like a mobile app inside the PWA. It loads the demo wallet once and
// shares it with the tab pages via the outlet context. The onboarding wizard
// lives on its own route outside this shell (no tab bar).

const TABS = [
  { to: "/worker", end: true, label: "Home", icon: HomeIcon },
  { to: "/worker/activity", end: false, label: "Activity", icon: ActivityIcon },
  { to: "/worker/wallet", end: false, label: "Wallet", icon: WalletIcon },
  { to: "/worker/settings", end: false, label: "Settings", icon: GearIcon },
];

export function WorkerShell() {
  // Capture the first-run state during the first render, BEFORE useDemoWallet's
  // effect creates a wallet, so a genuinely new visitor is still detectable.
  const [firstRun] = useState(() => !hasStoredDemoWallet() && !isOnboarded());
  const {
    wallet,
    lockState,
    fundState,
    retry,
    unlock,
    lock,
    refreshLockState,
  } = useDemoWallet();
  // Re-read the profile on every navigation so a name saved in Settings shows
  // up in the header chip without remounting the shell.
  useLocation();
  const profile = getWorkerProfile();
  const lockable = lockState === "unlocked" && hasVault();

  // Auto-lock: lock after the app has been HIDDEN for the timeout (checked on
  // the visibility flip back plus a backstop interval, since a background tab
  // may never fire the return event). The preference is read per check, so the
  // Settings toggle takes effect immediately. Never locks while visible: the
  // ticking-balance demo must not be interrupted on screen.
  useEffect(() => {
    if (!lockable) {
      return;
    }
    let hiddenAtMs: number | null = null;
    const lockIfExpired = () => {
      if (
        hiddenAtMs !== null &&
        isAutoLockEnabled() &&
        Date.now() - hiddenAtMs >= AUTO_LOCK_HIDDEN_MS
      ) {
        lock();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtMs = Date.now();
      } else {
        lockIfExpired();
        hiddenAtMs = null;
      }
    };
    const backstop = setInterval(lockIfExpired, 30_000);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(backstop);
    };
  }, [lockable, lock]);

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <BrandMark />
        <div className="flex items-center gap-2">
          <TestnetBadge />
          {lockable && (
            <button
              type="button"
              onClick={lock}
              aria-label="Lock the app now"
              className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <PadlockIcon />
            </button>
          )}
          {profile !== null && (
            <Link
              to="/worker/settings"
              aria-label="Your profile and settings"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-600 text-xs font-semibold text-white"
            >
              {avatarInitial(profile.name)}
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 py-6 pb-28">
        {lockState === "locked" ? (
          <UnlockScreen onUnlock={unlock} />
        ) : (
          <Outlet
            context={
              {
                wallet,
                fundState,
                retry,
                firstRun,
                lockState,
                lock,
                refreshLockState,
              } satisfies WorkerContext
            }
          />
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 mx-auto max-w-sm border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="flex">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cx(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors",
                  isActive
                    ? "text-teal-700"
                    : "text-slate-400 hover:text-slate-600",
                )
              }
            >
              <tab.icon />
              {tab.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

// Minimal inline stroke icons (no icon dependency, no CDN). aria-hidden: the text
// label beneath each is the accessible name.
function HomeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12h4l2 6 4-14 2 8h4" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M16 12.5h.01M20 10h-4a2 2 0 0 0 0 4h4" />
    </svg>
  );
}

function PadlockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8v2.4M12 18.8v2.4M4.03 7.4l2.08 1.2M17.89 15.4l2.08 1.2M4.03 16.6l2.08-1.2M17.89 8.6l2.08-1.2" />
    </svg>
  );
}
