import { NavLink, Outlet } from "react-router-dom";
import { NETWORK_LABEL } from "../lib/config";

// The shared shell around every route: the StreamPay wordmark, the employer and
// worker nav, and the unmistakable TESTNET badge that must be visible on every
// screen (honesty rule; ENGINEERING.md decision 15 design language: neutral
// surfaces, one teal accent, no gradients).

function navClass({ isActive }: { isActive: boolean }): string {
  const base =
    "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500";
  return isActive
    ? `${base} bg-teal-50 text-teal-700`
    : `${base} text-slate-600 hover:text-slate-900`;
}

export function Layout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-3 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600 text-sm font-bold text-white"
            >
              S
            </span>
            <span className="text-lg font-semibold tracking-tight">
              StreamPay
            </span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-800">
              {NETWORK_LABEL}
            </span>
          </div>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={navClass}>
              Employer
            </NavLink>
            <NavLink to="/worker" className={navClass}>
              Worker
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
