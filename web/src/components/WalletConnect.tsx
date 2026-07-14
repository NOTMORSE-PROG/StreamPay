import { explorerAccountUrl } from "../lib/config";
import { truncateAddress } from "../lib/format";
import type { WalletStatus } from "../lib/wallet";

// Presentational wallet control: renders every connection state (checking, not
// installed, wrong network, disconnected, connected) from props. The state
// machine lives in useWallet; this component only draws it and reports intent.

interface WalletConnectProps {
  status: WalletStatus;
  accessError: string | null;
  onConnect: () => void;
  onSignOut?: () => void;
}

const FREIGHTER_INSTALL_URL = "https://www.freighter.app/";

const buttonClass =
  "inline-flex items-center justify-center rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2";

export function WalletConnect({
  status,
  accessError,
  onConnect,
  onSignOut,
}: WalletConnectProps) {
  return (
    <div className="flex flex-col items-end gap-1">
      {renderStatus(status, onConnect, onSignOut)}
      {accessError !== null && (
        <p className="text-xs text-amber-700">{accessError}</p>
      )}
    </div>
  );
}

function renderStatus(
  status: WalletStatus,
  onConnect: () => void,
  onSignOut?: () => void,
): React.ReactNode {
  switch (status.kind) {
    case "checking":
      return (
        <span className="text-sm text-slate-400">
          Checking your wallet app...
        </span>
      );

    case "not-installed":
      return (
        <a
          href={FREIGHTER_INSTALL_URL}
          target="_blank"
          rel="noreferrer"
          className={buttonClass}
        >
          Install Freighter
        </a>
      );

    case "wrong-network":
      return (
        <div className="flex flex-col items-end gap-1">
          <button type="button" onClick={onConnect} className={buttonClass}>
            Retry
          </button>
          <p className="text-xs text-amber-700">
            Your wallet app is on {status.network}. Switch it to Testnet.
          </p>
        </div>
      );

    case "disconnected":
      return (
        <button type="button" onClick={onConnect} className={buttonClass}>
          Connect wallet app
        </button>
      );

    case "connected":
      return (
        <div className="flex items-center gap-2">
          <a
            href={explorerAccountUrl(status.address)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300"
            title={status.address}
          >
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full bg-teal-500"
            />
            <span className="font-mono">{truncateAddress(status.address)}</span>
          </a>
          {onSignOut !== undefined && (
            <button
              type="button"
              onClick={onSignOut}
              className="rounded-lg px-2 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              Sign out
            </button>
          )}
        </div>
      );
  }
}
