// Registers @testing-library/jest-dom matchers on vitest's expect and augments
// its types, so component tests (T-010 onward) can use toBeInTheDocument and
// friends. Loaded by vitest via setupFiles in vite.config.ts.
import "@testing-library/jest-dom/vitest";

import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// With vitest globals off, testing-library's auto-cleanup (which hooks a global
// afterEach) is not active, so renders would accumulate across tests. Register it
// explicitly here once for every component test.
afterEach(() => {
  cleanup();
});
