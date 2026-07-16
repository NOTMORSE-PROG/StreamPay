import { useCallback, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useWallet } from "../../hooks/useWallet";
import { WalletConnect } from "../WalletConnect";
import { SignInGate } from "../employer/SignInGate";
import { BrandMark } from "../ui/BrandMark";
import { TestnetBadge } from "../ui/TestnetBadge";
import { cx } from "../ui/cx";
import type { EmployerContext } from "../employer/context";

// The employer portal chrome: a web-dashboard header (brand, testnet badge, its
// own nav, the connected-wallet chip) and nothing from the worker side. It owns
// the wallet connection and, until one is connected, replaces the whole page with
// the sign-in gate. Once connected it shares the address, a refresh counter, and
// an onChanged callback with its pages via the router outlet context.

function navClass({ isActive }: { isActive: boolean }): string {
  return cx(
    "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500",
    isActive
      ? "bg-teal-50 text-teal-700"
      : "text-slate-600 hover:text-slate-900",
  );
}

export function EmployerShell() {
  const wallet = useWallet();
  const [refreshKey, setRefreshKey] = useState(0);
  const onChanged = useCallback(() => setRefreshKey((key) => key + 1), []);

  const connected = wallet.status.kind === "connected";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2">
              <BrandMark />
            </Link>
            <TestnetBadge />
          </div>
          {connected && (
            <div className="flex items-center gap-3">
              <nav className="hidden items-center gap-1 sm:flex">
                <NavLink to="/employer" end className={navClass}>
                  Dashboard
                </NavLink>
                <NavLink to="/employer/create" className={navClass}>
                  Create stream
                </NavLink>
                <NavLink to="/employer/settings" className={navClass}>
                  Settings
                </NavLink>
              </nav>
              <WalletConnect
                status={wallet.status}
                accessError={wallet.accessError}
                onConnect={() => void wallet.connect()}
                onSignOut={wallet.signOut}
              />
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {connected && wallet.status.kind === "connected" ? (
          <Outlet
            context={
              {
                address: wallet.status.address,
                refreshKey,
                onChanged,
                signOut: wallet.signOut,
              } satisfies EmployerContext
            }
          />
        ) : (
          <SignInGate wallet={wallet} />
        )}
      </main>
    </div>
  );
}
