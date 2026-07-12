import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { loadOrCreateDemoWallet, type DemoWallet } from "../lib/demoWallet";
import { accountExists, streamsByWorker } from "../lib/contract";
import { explorerAccountUrl, friendbotUrl } from "../lib/config";

// The worker pre-stream route (/worker): the demo-wallet address handoff that
// closes the address chicken-and-egg gap (ENGINEERING.md decision 11). The worker
// gets an address to give the employer BEFORE any stream exists. Phone-first,
// clearly labeled demo-and-testnet (honesty rule).

type FundState = "checking" | "funding" | "funded" | "failed";

export function WorkerOnboarding() {
  const [wallet, setWallet] = useState<DemoWallet | null>(null);
  const [fundState, setFundState] = useState<FundState>("checking");
  const [streamIds, setStreamIds] = useState<bigint[]>([]);
  const [copied, setCopied] = useState(false);
  const startedRef = useRef(false);

  // Generate or load the wallet once, on the client (localStorage + SDK keypair).
  useEffect(() => {
    setWallet(loadOrCreateDemoWallet());
  }, []);

  const ensureFunded = useCallback(async (publicKey: string): Promise<void> => {
    setFundState("checking");
    if (await accountExists(publicKey)) {
      setFundState("funded");
      return;
    }
    setFundState("funding");
    try {
      const response = await fetch(friendbotUrl(publicKey));
      // Friendbot answers 400 if the account already exists; re-check the chain
      // rather than trusting the status, so a race still resolves to funded.
      if (response.ok || (await accountExists(publicKey))) {
        setFundState("funded");
      } else {
        setFundState("failed");
      }
    } catch {
      setFundState("failed");
    }
  }, []);

  // Fund the account (so it can later pay withdrawal fees) and load any streams
  // already paying this address. Runs once per loaded wallet.
  useEffect(() => {
    if (wallet === null || startedRef.current) {
      return;
    }
    startedRef.current = true;
    void ensureFunded(wallet.publicKey);
    void (async () => {
      try {
        setStreamIds(await streamsByWorker(wallet.publicKey));
      } catch {
        setStreamIds([]); // no streams yet, or a transient read error
      }
    })();
  }, [wallet, ensureFunded]);

  const copyAddress = useCallback(() => {
    if (wallet === null) {
      return;
    }
    void navigator.clipboard.writeText(wallet.publicKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [wallet]);

  if (wallet === null) {
    return (
      <div className="mx-auto max-w-sm text-center text-sm text-slate-500">
        Setting up your demo wallet...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Your wallet</h1>
        <p className="mt-1 text-sm text-slate-600">
          Share this address with your employer to start getting paid per
          second.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Your address
          </span>
          <FundBadge state={fundState} />
        </div>
        <p className="mt-2 break-all font-mono text-sm text-slate-900">
          {wallet.publicKey}
        </p>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={copyAddress}
            className="flex-1 rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            {copied ? "Copied" : "Copy address"}
          </button>
          <a
            href={explorerAccountUrl(wallet.publicKey)}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-teal-700"
          >
            Explorer
          </a>
        </div>
        {fundState === "failed" && (
          <p className="mt-3 text-xs text-amber-700">
            Testnet funding did not complete. Your address still works; it will
            be funded before you withdraw. You can retry from the explorer
            friendbot.
          </p>
        )}
      </section>

      {!wallet.persisted && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
          This browser is not saving your wallet (private mode?). If you reload,
          a new address is created and earlier earnings would be stranded. Use a
          normal browser window for the demo.
        </p>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Your streams</h2>
        {streamIds.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            No streams yet. Once your employer creates one to your address, it
            appears here and starts ticking.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {streamIds.map((id) => (
              <li key={id.toString()}>
                <Link
                  to={`/worker/${id.toString()}`}
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 hover:border-teal-300 hover:text-teal-700"
                >
                  <span>Stream #{id.toString()}</span>
                  <span aria-hidden="true">&rarr;</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-center text-xs text-slate-400">
        Demo wallet, Stellar testnet only. No seed phrase, no real money; the
        key lives in this browser for the demo. Production uses passkeys.
      </p>
    </div>
  );
}

function FundBadge({ state }: { state: FundState }) {
  const map: Record<FundState, { label: string; className: string }> = {
    checking: { label: "Checking", className: "bg-slate-100 text-slate-500" },
    funding: { label: "Funding", className: "bg-blue-50 text-blue-700" },
    funded: { label: "Testnet ready", className: "bg-teal-50 text-teal-700" },
    failed: { label: "Fund later", className: "bg-amber-50 text-amber-700" },
  };
  const badge = map[state];
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}
    >
      {badge.label}
    </span>
  );
}
