import { useState } from "react";
import { exportSecretWithPin, importSecretWithPin } from "../../lib/demoWallet";
import { hasVault } from "../../lib/vault";
import { Button } from "../ui/Button";
import { PinInput } from "./PinInput";
import { SetPinForm } from "./SetPinForm";

// Backup and restore for the demo wallet (T-044): reveal is PIN re-authed when
// a vault exists (a shoulder-surfer with the unlocked app still cannot read the
// key without the PIN), and restore always sets a fresh PIN so the restored
// wallet lands encrypted. In the legacy (no-vault) world reveal returns the
// plaintext, exactly as before, and restoring upgrades it to a vault.

export function BackupRestore() {
  const vault = hasVault();
  const [secret, setSecret] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [revealError, setRevealError] = useState(false);
  const [restoreInput, setRestoreInput] = useState("");
  const [restoreError, setRestoreError] = useState(false);

  async function reveal(): Promise<void> {
    const result = await exportSecretWithPin(pin);
    if (result === null) {
      setRevealError(true);
    } else {
      setSecret(result);
      setRevealError(false);
    }
  }

  async function restore(newPin: string): Promise<void> {
    if (await importSecretWithPin(restoreInput, newPin)) {
      // Reload so the shell picks up the restored, unlocked wallet.
      window.location.assign("/worker");
    } else {
      setRestoreError(true);
    }
  }

  return (
    <details className="rounded-2xl border border-slate-200 bg-white p-5">
      <summary className="cursor-pointer text-sm font-semibold text-slate-900">
        Back up or restore this account
      </summary>
      <div className="mt-4 space-y-4">
        <p className="text-xs text-slate-500">
          To use the same account on another device, copy this backup code and
          paste it there. On this test demo it guards only test funds; never
          reuse a demo code for real money. The real product replaces this with
          passkeys.
        </p>

        <div className="space-y-2">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Backup code
          </span>
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
                label="Enter your PIN to reveal it"
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
                Show backup code
              </Button>
            </form>
          ) : (
            <Button
              variant="secondary"
              onClick={() => void reveal()}
              className="w-full"
            >
              Show backup code
            </Button>
          )}
        </div>

        <div className="space-y-2 border-t border-slate-100 pt-4">
          <label
            htmlFor="restore-secret"
            className="text-xs font-medium uppercase tracking-wide text-slate-400"
          >
            Restore from a backup code
          </label>
          <p className="text-xs text-slate-500">
            Restoring replaces the account currently on this device. You will
            set a new PIN for the restored account.
          </p>
          <SetPinForm
            submitLabel="Restore account"
            busyLabel="Restoring"
            extraField={
              <input
                id="restore-secret"
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
      </div>
    </details>
  );
}
