import { useState } from "react";
import {
  avatarInitial,
  getWorkerProfile,
  setWorkerName,
} from "../../lib/profile";
import { hasVault } from "../../lib/vault";
import {
  changePin,
  exportSecretWithPin,
  lockWallet,
  migrateLegacyToPin,
} from "../../lib/demoWallet";
import { wipeWorkerDevice } from "../../lib/wipe";
import { isAutoLockEnabled, setAutoLockEnabled } from "../../lib/autolock";
import { useWorkerContext } from "../../components/worker/context";
import { useDisplayCurrency } from "../../hooks/useDisplayCurrency";
import { CurrencyToggle } from "../../components/worker/CurrencyToggle";
import { BackupRestore } from "../../components/worker/BackupRestore";
import { SetPinForm } from "../../components/worker/SetPinForm";
import { PinInput } from "../../components/worker/PinInput";
import { NetworkInfo } from "../../components/NetworkInfo";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";

// The worker's Settings tab (T-042): profile, display currency, wallet
// security, backup/restore, and the network facts. The lock controls (set or
// change PIN, lock now, auto-lock) land here in T-043/T-044; the guarded
// log-out lands in T-045.

export function WorkerSettings() {
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Settings
        </h1>
        <p className="text-sm text-slate-500">
          Your profile, display preferences, and account safety.
        </p>
      </header>

      <ProfileSection />

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">
          Display currency
        </h2>
        <p className="text-xs text-slate-500">
          Amounts are always earned and paid in test tokens (test-XLM); the
          other figures are a labeled demo rate.
        </p>
        <CurrencySetting />
      </Card>

      <SecuritySection />

      <BackupRestore />

      <NetworkInfo />

      <LogOutSection />
    </div>
  );
}

function LogOutSection() {
  const { lockState } = useWorkerContext();
  const [open, setOpen] = useState(false);
  const vault = lockState === "unlocked" && hasVault();

  return (
    <Card className="space-y-3 border-amber-200">
      <h2 className="text-sm font-semibold text-slate-900">
        Log out of this device
      </h2>
      <p className="text-sm text-slate-600">
        This erases your account and all StreamPay data from this device. Your
        money stays safe on the network; you can get it back only by restoring
        your backup code.
      </p>
      <Button
        variant="quiet-danger"
        onClick={() => setOpen(true)}
        className="w-full"
      >
        Log out of this device
      </Button>
      {open && <LogOutDialog vault={vault} onClose={() => setOpen(false)} />}
    </Card>
  );
}

function LogOutDialog({
  vault,
  onClose,
}: {
  vault: boolean;
  onClose: () => void;
}) {
  const [pin, setPin] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [revealError, setRevealError] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  async function reveal(): Promise<void> {
    const result = await exportSecretWithPin(pin);
    if (result === null) {
      setRevealError(true);
    } else {
      setSecret(result);
      setRevealError(false);
    }
  }

  function wipe(): void {
    lockWallet();
    wipeWorkerDevice();
    // Hard navigation so module memory (session key, onboarding flag) resets
    // and the app lands on onboarding as a genuine first run.
    window.location.assign("/worker");
  }

  return (
    <Dialog title="Log out of this device" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Save your backup code first if you want to keep this account. Without
          it, this account cannot be recovered.
        </p>

        <div className="space-y-2">
          {secret !== null ? (
            <p className="break-all rounded-lg bg-amber-50 px-3 py-2 font-mono text-xs text-amber-900">
              {secret}
            </p>
          ) : vault ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void reveal();
              }}
              className="space-y-2"
            >
              <PinInput
                label="Enter your PIN to show your backup code"
                value={pin}
                onChange={(next) => {
                  setPin(next);
                  setRevealError(false);
                }}
              />
              {revealError && (
                <p className="text-sm text-red-600" role="alert">
                  That PIN is not right.
                </p>
              )}
              <Button
                type="submit"
                variant="secondary"
                disabled={pin.length !== 6}
                className="w-full"
              >
                Show my backup code first
              </Button>
            </form>
          ) : (
            <Button
              variant="secondary"
              onClick={() => void reveal()}
              className="w-full"
            >
              Show my backup code first
            </Button>
          )}
        </div>

        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            className="mt-0.5"
          />
          I have saved my backup code, or I accept losing this account.
        </label>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="quiet-danger"
            disabled={!acknowledged}
            onClick={wipe}
            className="flex-1"
          >
            Erase and log out
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function CurrencySetting() {
  const { currency, setCurrency } = useDisplayCurrency();
  return <CurrencyToggle currency={currency} onChange={setCurrency} />;
}

function SecuritySection() {
  const { lockState, lock, refreshLockState } = useWorkerContext();
  const [autoLock, setAutoLock] = useState(isAutoLockEnabled);
  const [changingPin, setChangingPin] = useState(false);
  const pinActive = lockState === "unlocked" && hasVault();
  const legacy = lockState === "legacy";

  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-900">Account security</h2>
      {pinActive && (
        <>
          <p className="text-sm text-slate-600">
            Your account is locked on this device with your PIN.
          </p>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={autoLock}
              onChange={(event) => {
                setAutoLockEnabled(event.target.checked);
                setAutoLock(event.target.checked);
              }}
              className="mt-0.5"
            />
            Lock automatically 5 minutes after you leave the app
          </label>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setChangingPin(true)}
              className="flex-1"
            >
              Change PIN
            </Button>
            <Button variant="secondary" onClick={lock} className="flex-1">
              Lock now
            </Button>
          </div>
          {changingPin && (
            <ChangePinDialog onClose={() => setChangingPin(false)} />
          )}
        </>
      )}

      {legacy && (
        <>
          <p className="text-sm text-slate-600">
            Your account is stored on this device without a PIN. Set one to lock
            it, so no one who picks up your phone can open the app.
          </p>
          <SetPinForm
            submitLabel="Set a PIN"
            busyLabel="Locking your account"
            onSubmit={async (pin) => {
              const ok = await migrateLegacyToPin(pin);
              if (ok) {
                refreshLockState();
              }
            }}
          />
        </>
      )}

      {!pinActive && !legacy && (
        <p className="text-sm text-slate-600">
          Your demo account lives on this device only. Back it up below so you
          can restore it if you lose the device. In the real product your
          account is protected by a passkey (your fingerprint or face) with
          proper recovery.
        </p>
      )}
    </Card>
  );
}

function ChangePinDialog({ onClose }: { onClose: () => void }) {
  const [currentPin, setCurrentPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  return (
    <Dialog title="Change your PIN" onClose={onClose}>
      {done ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Your PIN has been updated.</p>
          <Button onClick={onClose} className="w-full">
            Done
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <PinInput
            label="Current PIN"
            value={currentPin}
            onChange={(next) => {
              setCurrentPin(next);
              setError(null);
            }}
          />
          <SetPinForm
            submitLabel="Change PIN"
            busyLabel="Updating"
            onSubmit={async (newPin) => {
              const result = await changePin(currentPin, newPin);
              if (result.ok) {
                setDone(true);
              } else {
                setError(
                  result.reason === "wrong-pin"
                    ? "Your current PIN is not right."
                    : "Something went wrong. Nothing was changed.",
                );
              }
            }}
          />
          {error !== null && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}

function ProfileSection() {
  const [name, setName] = useState(() => getWorkerProfile()?.name ?? "");
  const [savedName, setSavedName] = useState(name);

  const initial = avatarInitial(savedName);
  const dirty = name.trim() !== savedName;

  function save(): void {
    setWorkerName(name);
    setSavedName(getWorkerProfile()?.name ?? "");
  }

  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-900">Profile</h2>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-600 font-semibold text-white"
        >
          {initial === "" ? "?" : initial}
        </span>
        <div className="min-w-0 flex-1">
          <label
            htmlFor="profile-name"
            className="text-xs font-medium uppercase tracking-wide text-slate-400"
          >
            Display name
          </label>
          <input
            id="profile-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="How should we greet you?"
            maxLength={40}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
          />
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Shown only on this device and in the share message when you hand your
        account number to an employer. Leave it empty to remove it.
      </p>
      <Button
        variant="secondary"
        disabled={!dirty}
        onClick={save}
        className="w-full"
      >
        Save name
      </Button>
    </Card>
  );
}
