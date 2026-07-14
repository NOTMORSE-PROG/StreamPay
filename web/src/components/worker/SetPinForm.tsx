import { useState, type ReactNode } from "react";
import { Button } from "../ui/Button";
import { PinInput, PIN_LENGTH } from "./PinInput";

// Choose-a-PIN form (enter + confirm) shared by onboarding, the legacy
// "Set a PIN" migration, and restore-with-PIN. Validates the two entries
// match and are the right length before calling onSubmit; shows a busy label
// while the async work (vault encryption) runs.

export function SetPinForm({
  submitLabel,
  busyLabel = "Saving",
  extraField,
  onSubmit,
}: {
  submitLabel: string;
  busyLabel?: string;
  /** Rendered above the PIN fields (for example, the secret-key input on the
   *  restore flow). */
  extraField?: ReactNode;
  onSubmit: (pin: string) => Promise<void> | void;
}) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ready = pin.length === PIN_LENGTH && confirm.length === PIN_LENGTH;

  async function submit(): Promise<void> {
    if (!ready || busy) {
      return;
    }
    if (pin !== confirm) {
      setError("Those PINs do not match. Try again.");
      setConfirm("");
      return;
    }
    setBusy(true);
    try {
      await onSubmit(pin);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="space-y-3"
    >
      {extraField}
      <PinInput
        label="Choose a PIN"
        value={pin}
        onChange={(next) => {
          setPin(next);
          setError(null);
        }}
      />
      <PinInput
        label="Confirm PIN"
        value={confirm}
        onChange={(next) => {
          setConfirm(next);
          setError(null);
        }}
      />
      {error !== null && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={!ready || busy} className="w-full">
        {busy ? busyLabel : submitLabel}
      </Button>
    </form>
  );
}
