import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useWorkerContext } from "../../components/worker/context";
import { useWorkerStreams } from "../../hooks/useWorkerStreams";
import { getNickname, progressPercent } from "../../lib/streams";
import type { StreamRow } from "../../lib/streams";
import { withdrawableStroops } from "../../lib/accrual";
import { stroopsToXlm } from "../../lib/format";
import { Card } from "../../components/ui/Card";
import { Stat } from "../../components/ui/Stat";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { ButtonLink } from "../../components/ui/Button";
import { InfoHint } from "../../components/ui/InfoHint";
import { CurrencyToggle } from "../../components/worker/CurrencyToggle";
import { useDisplayCurrency } from "../../hooks/useDisplayCurrency";
import { usePrivacyMode } from "../../hooks/usePrivacyMode";
import { formatInCurrency, isConverted } from "../../lib/currency";
import { hiddenOr } from "../../lib/privacy";
import { getWorkerProfile } from "../../lib/profile";
import { getEmployerLabel } from "../../lib/employerLabels";

// The worker's app home: what they can withdraw right now and what they have
// earned in total, then a card per stream. Figures refresh from the chain on the
// ~6 s poll (the per-second ticking hero lives on the single-stream detail). Past
// streams sit below the active ones so the top of the screen stays about money now.

function sumAccrued(rows: StreamRow[]): bigint {
  return rows.reduce((total, row) => total + row.accrued, 0n);
}

function sumAvailable(rows: StreamRow[]): bigint {
  return rows.reduce(
    (total, row) => total + withdrawableStroops(row.stream, row.accrued),
    0n,
  );
}

export function WorkerHome() {
  const { wallet, firstRun, lockState } = useWorkerContext();
  const { currency, setCurrency } = useDisplayCurrency();
  const { hidden, toggle: togglePrivacy } = usePrivacyMode();
  const workerAddress = wallet?.publicKey ?? null;
  const { rows, loading, error } = useWorkerStreams(workerAddress);

  // A brand-new visitor (no wallet, no onboarding) starts in the wizard. Only the
  // Home index redirects; a shared /worker/:streamId link never does. The hooks
  // above run unconditionally (rules of hooks); firstRun is stable per mount.
  if (firstRun) {
    return <Navigate to="/worker/onboarding" replace />;
  }

  // Onboarded (or skipped) but no wallet exists: creation is explicit since
  // T-041, so point at the wizard instead of spinning forever.
  if (wallet === null && lockState === "none") {
    return (
      <Card dashed className="mt-6 space-y-3 p-6 text-center">
        <p className="text-sm text-slate-600">
          No account on this device yet. Set one up to start getting paid.
        </p>
        <ButtonLink to="/worker/onboarding" className="w-full">
          Set up your account
        </ButtonLink>
      </Card>
    );
  }

  if (wallet === null || (loading && rows.length === 0)) {
    return (
      <p className="py-10 text-center text-sm text-slate-500">
        Loading your earnings...
      </p>
    );
  }

  const active = rows.filter((row) => row.state === "active");
  const past = rows.filter((row) => row.state !== "active");
  const available = sumAvailable(rows);
  const earned = sumAccrued(rows);
  const profileName = getWorkerProfile()?.name ?? null;

  return (
    <div className="space-y-6">
      {lockState === "legacy" && <ProtectWithPinBanner />}

      <header className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          {profileName !== null && (
            <p className="truncate text-sm font-medium text-teal-700">
              Hi, {profileName}
            </p>
          )}
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Your earnings
          </h1>
          <p className="text-sm text-slate-500">
            Your pay so far, ready to cash out anytime.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <PrivacyToggle hidden={hidden} onToggle={togglePrivacy} />
          <CurrencyToggle currency={currency} onChange={setCurrency} />
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="Available now"
          value={hiddenOr(stroopsToXlm(available, { group: true }), hidden)}
          hint={
            hidden
              ? "Hidden"
              : isConverted(currency)
                ? `≈ ${formatInCurrency(available, currency)} (demo rate)`
                : "Ready to cash out now"
          }
          emphasis
        />
        <Stat
          label="Earned so far"
          value={hiddenOr(stroopsToXlm(earned, { group: true }), hidden)}
          hint={
            hidden
              ? "Hidden"
              : isConverted(currency)
                ? `≈ ${formatInCurrency(earned, currency)} (demo rate)`
                : "Across all your pay"
          }
        />
      </div>

      {error !== null && rows.length === 0 && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">
          {error}
        </p>
      )}

      {rows.length === 0 ? (
        <Card dashed className="space-y-3 p-6 text-center">
          <p className="text-sm text-slate-600">
            No pay yet. Share your account number with your employer and your
            first paycheck shows up here.
          </p>
          <ButtonLink
            to="/worker/wallet"
            variant="secondary"
            className="w-full"
          >
            Show my account number
          </ButtonLink>
        </Card>
      ) : (
        <div className="space-y-4">
          <section className="space-y-3">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              Getting paid now
              <InfoHint label="What getting paid now means">
                Each active paycheck adds a fixed amount every second from money
                your employer already set aside. It keeps growing until the pay
                period ends, and you can cash out the earned part whenever you
                want.
              </InfoHint>
            </h2>
            {active.length === 0 ? (
              <p className="text-sm text-slate-500">No active pay right now.</p>
            ) : (
              active.map((row) => (
                <StreamRowCard key={idKey(row)} row={row} hidden={hidden} />
              ))
            )}
          </section>

          {past.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-900">Past</h2>
              {past.map((row) => (
                <StreamRowCard key={idKey(row)} row={row} hidden={hidden} />
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function ProtectWithPinBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) {
    return null;
  }
  return (
    <div className="flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
      <p className="flex-1 text-sm text-teal-900">
        Protect this account with a PIN so no one who picks up your phone can
        open it.{" "}
        <Link
          to="/worker/settings"
          className="font-semibold underline underline-offset-2"
        >
          Set a PIN
        </Link>
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="text-teal-600 hover:text-teal-800"
      >
        &times;
      </button>
    </div>
  );
}

function PrivacyToggle({
  hidden,
  onToggle,
}: {
  hidden: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={hidden}
      aria-label={hidden ? "Show amounts" : "Hide amounts"}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
    >
      {hidden ? <EyeOffIcon /> : <EyeIcon />}
    </button>
  );
}

function EyeIcon() {
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
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
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
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A9.9 9.9 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4M6.6 6.6A17.6 17.6 0 0 0 2 12s3.5 7 10 7a9.9 9.9 0 0 0 4-.8" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

function idKey(row: StreamRow): string {
  return row.stream.id.toString();
}

function StreamRowCard({ row, hidden }: { row: StreamRow; hidden: boolean }) {
  const { stream, accrued, state } = row;
  const label = getNickname(stream.id) ?? `Paycheck #${stream.id.toString()}`;
  const employerLabel = getEmployerLabel(stream.employer);
  const percent = progressPercent(stream, accrued);
  const available = withdrawableStroops(stream, accrued);

  return (
    <Link
      to={`/worker/${stream.id.toString()}`}
      className="block rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-teal-300"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="font-semibold text-slate-900">{label}</span>
          {employerLabel !== null && (
            <span className="block truncate text-xs text-slate-400">
              from {employerLabel}
            </span>
          )}
        </div>
        <StatusBadge state={state} context="worker" />
      </div>
      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-2xl font-semibold tabular-nums text-slate-900">
          {hiddenOr(stroopsToXlm(available, { group: true }), hidden)}
          <span className="ml-1 text-sm font-medium text-slate-400">XLM</span>
        </span>
        <span className="text-xs text-slate-400">available</span>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-teal-500"
          style={{ width: `${percent.toString()}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-slate-400 tabular-nums">
        {percent}% of this pay period earned
      </p>
    </Link>
  );
}
