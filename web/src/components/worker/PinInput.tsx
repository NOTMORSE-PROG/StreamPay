import { useId } from "react";

// The one PIN field used by the unlock screen, onboarding, and the Settings
// PIN flows: 6 digits, numeric keyboard on phones, non-digits stripped, value
// masked. Kept dumb (controlled) so every flow owns its own submit logic.

export const PIN_LENGTH = 6;

export function PinInput({
  id,
  label,
  value,
  onChange,
  autoFocus = false,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (pin: string) => void;
  autoFocus?: boolean;
}) {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  return (
    <div className="space-y-1 text-left">
      <label
        htmlFor={inputId}
        className="text-xs font-medium uppercase tracking-wide text-slate-400"
      >
        {label}
      </label>
      <input
        id={inputId}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        maxLength={PIN_LENGTH}
        value={value}
        autoFocus={autoFocus}
        onChange={(event) =>
          onChange(event.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH))
        }
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center font-mono text-lg tracking-[0.5em] focus:border-teal-500 focus:outline-none"
      />
    </div>
  );
}
