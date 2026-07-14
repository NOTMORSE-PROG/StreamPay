import { DISPLAY_CURRENCIES, type DisplayCurrency } from "../../lib/currency";
import { cx } from "../ui/cx";

// A small XLM / USD / PHP segmented control for the worker screens. XLM is the
// on-chain truth; the others are indicative demo conversions shown as a secondary
// figure, so the worker can read their pay in a familiar currency.

export function CurrencyToggle({
  currency,
  onChange,
}: {
  currency: DisplayCurrency;
  onChange: (currency: DisplayCurrency) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Display currency"
      className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5"
    >
      {DISPLAY_CURRENCIES.map((c) => (
        <button
          key={c}
          type="button"
          aria-pressed={c === currency}
          onClick={() => onChange(c)}
          className={cx(
            "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
            c === currency
              ? "bg-teal-600 text-white"
              : "text-slate-500 hover:text-slate-800",
          )}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
