import { useCallback, useState } from "react";
import { isPrivacyOn, setPrivacyOn } from "../lib/privacy";

// The worker's balance-privacy preference (T-048), read once and toggled in
// place. Home reads this to mask its money figures.

export interface UsePrivacyMode {
  hidden: boolean;
  toggle: () => void;
}

export function usePrivacyMode(): UsePrivacyMode {
  const [hidden, setHidden] = useState(isPrivacyOn);

  const toggle = useCallback(() => {
    setHidden((prev) => {
      const next = !prev;
      setPrivacyOn(next);
      return next;
    });
  }, []);

  return { hidden, toggle };
}
