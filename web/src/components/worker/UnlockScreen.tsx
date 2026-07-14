import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  clearDemoWallet,
  importSecretWithPin,
  type UnlockResult,
} from "../../lib/demoWallet";
import { BrandMark } from "../ui/BrandMark";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { PinInput } from "./PinInput";
import { SetPinForm } from "./SetPinForm";

// The worker unlock screen (T-043): shown by WorkerShell in place of the page
// content while the vault is locked. The URL is untouched, so a locked deep
// link unlocks straight into the requested screen. The growing retry delay is
// fat-finger FRICTION ONLY: with no server, nothing rate-limits an attacker
// who copies the stored envelope, and the copy below says so plainly.

const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 4_000;

export function UnlockScreen({
  onUnlock,
}: {
  onUnlock: (pin: string) => Promise<UnlockResult>;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<"wrong-pin" | "corrupt" | null>(null);
  const [coolingDown, setCoolingDown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const delayRef = useRef(BASE_DELAY_MS);

  async function submit(): Promise<void> {
    if (pin.length !== 6 || busy || coolingDown) {
      return;
    }
    setBusy(true);
    const result = await onUnlock(pin);
    setBusy(false);
    if (result.ok) {
      return; // the shell re-renders the page content
    }
    setPin("");
    if (result.reason === "corrupt") {
      setError("corrupt");
      return;
    }
    setError("wrong-pin");
    setCoolingDown(true);
    const delay = delayRef.current;
    delayRef.current = Math.min(delay * 2, MAX_DELAY_MS);
    setTimeout(() => setCoolingDown(false), delay);
  }

  return (
    <div className="flex flex-col items-center gap-6 py-10 text-center">
      <BrandMark />
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Enter your PIN
        </h1>
        <p className="text-sm text-slate-500">
          Your account is locked on this device.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="w-full max-w-xs space-y-4"
      >
        <PinInput
          id="unlock-pin"
          label="PIN"
          value={pin}
          onChange={(next) => {
            setPin(next);
            setError(null);
          }}
        />
        {error === "wrong-pin" && (
          <p className="text-sm text-red-600" role="alert">
            That PIN is not right. Check it and try again.
          </p>
        )}
        {error === "corrupt" && (
          <p className="text-sm text-red-600" role="alert">
            The saved account data on this device is damaged and cannot be
            opened. If you have your backup code, use Forgot your PIN below to
            restore it.
          </p>
        )}
        <Button
          type="submit"
          disabled={pin.length !== 6 || busy || coolingDown}
          className="w-full"
        >
          {busy ? "Unlocking" : coolingDown ? "Wait a moment" : "Unlock"}
        </Button>
      </form>

      <p className="max-w-xs text-xs text-slate-400">
        Your account is locked with your PIN. On this test demo a short PIN is
        for convenience, not bank-grade protection; the real product uses
        passkeys.
      </p>

      <button
        type="button"
        onClick={() => setForgotOpen(true)}
        className="text-sm font-medium text-teal-700 underline-offset-2 hover:underline"
      >
        Forgot your PIN?
      </button>

      {forgotOpen && <ForgotPinDialog onClose={() => setForgotOpen(false)} />}
    </div>
  );
}

function ForgotPinDialog({ onClose }: { onClose: () => void }) {
  const [confirmed, setConfirmed] = useState(false);
  const [erased, setErased] = useState(false);
  const [restoreInput, setRestoreInput] = useState("");
  const [restoreError, setRestoreError] = useState(false);
  const navigate = useNavigate();

  function erase(): void {
    clearDemoWallet();
    setErased(true);
  }

  function startFresh(): void {
    void navigate("/worker/onboarding");
  }

  async function restore(newPin: string): Promise<void> {
    if (await importSecretWithPin(restoreInput, newPin)) {
      window.location.assign("/worker");
    } else {
      setRestoreError(true);
    }
  }

  return (
    <Dialog title="Forgot your PIN?" onClose={onClose}>
      {erased ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            This account has been erased from this device. If you have your
            backup code, restore it with a new PIN. Otherwise start fresh with a
            new account.
          </p>
          <div className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Restore from a backup code
            </span>
            <SetPinForm
              submitLabel="Restore account"
              busyLabel="Restoring"
              extraField={
                <input
                  aria-label="Backup code"
                  value={restoreInput}
                  onChange={(event) => {
                    setRestoreInput(event.target.value);
                    setRestoreError(false);
                  }}
                  placeholder="Paste your backup code (starts with S)"
                  spellCheck={false}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-teal-500 focus:outline-none"
                />
              }
              onSubmit={restore}
            />
            {restoreError && (
              <p className="text-sm text-red-600" role="alert">
                That is not a valid backup code. Nothing was changed.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={startFresh}
            className="w-full text-sm font-medium text-teal-700 underline-offset-2 hover:underline"
          >
            No backup? Start fresh with a new account
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            We cannot recover your PIN. The only way forward is to erase this
            account from this device. If you have your backup code, you can
            restore the same account with a new PIN. Without a backup, a new
            account means a new account number, and your employer must restart
            your pay to it.
          </p>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-0.5"
            />
            I understand this erases the account on this device.
          </label>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              variant="quiet-danger"
              disabled={!confirmed}
              onClick={erase}
              className="flex-1"
            >
              Erase this account
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
