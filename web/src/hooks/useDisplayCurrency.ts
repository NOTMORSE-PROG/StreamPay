import { useCallback, useState } from "react";
import {
  getDisplayCurrency,
  setDisplayCurrency,
  type DisplayCurrency,
} from "../lib/currency";

// The worker's chosen local-currency display, read once and persisted on change.
// A worker thinks in pesos, not lumens, so the screens can show an indicative
// local figure alongside the on-chain XLM truth.

export interface UseDisplayCurrency {
  currency: DisplayCurrency;
  setCurrency: (currency: DisplayCurrency) => void;
}

export function useDisplayCurrency(): UseDisplayCurrency {
  const [currency, setCurrencyState] = useState<DisplayCurrency>(() =>
    getDisplayCurrency(),
  );
  const setCurrency = useCallback((next: DisplayCurrency) => {
    setCurrencyState(next);
    setDisplayCurrency(next);
  }, []);
  return { currency, setCurrency };
}
