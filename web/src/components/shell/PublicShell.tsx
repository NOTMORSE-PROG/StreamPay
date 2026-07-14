import { Link, Outlet } from "react-router-dom";
import { BrandMark } from "../ui/BrandMark";
import { TestnetBadge } from "../ui/TestnetBadge";

// The chrome for the public pages (landing, not-found): the brand, the honesty
// badge, and two plain entry links into the two sides. No wallet state here, so a
// cold visitor sees the story before any connection prompt.

export function PublicShell() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <BrandMark />
          </Link>
          <div className="flex items-center gap-4">
            <TestnetBadge />
            <nav className="hidden items-center gap-4 text-sm font-medium text-slate-600 sm:flex">
              <Link to="/employer" className="hover:text-slate-900">
                For employers
              </Link>
              <Link to="/worker" className="hover:text-slate-900">
                For workers
              </Link>
            </nav>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-5xl px-4 pb-10 text-xs text-slate-400 sm:px-6">
        StreamPay is running in test mode. Balances are test tokens, not real
        money.
      </footer>
    </div>
  );
}
