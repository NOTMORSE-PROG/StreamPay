import {
  DEMO_RATE_USD_TO_PHP,
  DEMO_RATE_XLM_TO_USD,
  TOKEN_DECIMALS,
} from "./config";

// Local-currency DISPLAY helpers for the worker. The streamed token is test-XLM
// (standing in for USDC in production); this converts a stroops amount to an
// indicative USD or PHP figure for readability, always labeled "demo rate". This
// is display only: the value never round-trips back into a transaction, so a
// display float here does not violate the stroops-only money rule (the amounts are
// small demo values, well within safe-integer range).

export type DisplayCurrency = "XLM" | "USD" | "PHP";

export const DISPLAY_CURRENCIES: DisplayCurrency[] = ["XLM", "USD", "PHP"];

const PREF_KEY = "streampay:display-currency";

function xlmFromStroops(stroops: bigint): number {
  return Number(stroops) / 10 ** TOKEN_DECIMALS;
}

/**
 * Format a stroops amount in the chosen display currency. XLM is the on-chain
 * truth; USD and PHP are indicative demo conversions. Returns the number with its
 * symbol; callers add the "demo rate" label for non-XLM.
 */
export function formatInCurrency(
  stroops: bigint,
  currency: DisplayCurrency,
): string {
  const xlm = xlmFromStroops(stroops);
  if (currency === "XLM") {
    return `${xlm.toLocaleString(undefined, { maximumFractionDigits: 7 })} XLM`;
  }
  const usd = xlm * DEMO_RATE_XLM_TO_USD;
  if (currency === "USD") {
    return `$${usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  const php = usd * DEMO_RATE_USD_TO_PHP;
  return `₱${php.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Whether a currency needs the "demo rate" caveat (everything except XLM). */
export function isConverted(currency: DisplayCurrency): boolean {
  return currency !== "XLM";
}

/** The worker's saved display-currency preference (defaults to XLM). */
export function getDisplayCurrency(): DisplayCurrency {
  try {
    const saved = localStorage.getItem(PREF_KEY);
    if (saved === "USD" || saved === "PHP" || saved === "XLM") {
      return saved;
    }
  } catch {
    // storage unavailable; fall through to the default
  }
  return "XLM";
}

/** Save the worker's display-currency preference. */
export function setDisplayCurrency(currency: DisplayCurrency): void {
  try {
    localStorage.setItem(PREF_KEY, currency);
  } catch {
    // private mode: the choice simply does not persist across reloads
  }
}
