import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isOnboarded, markOnboarded, resetOnboarding } from "./onboarding";

describe("onboarding flag", () => {
  beforeEach(() => {
    localStorage.clear();
    resetOnboarding();
  });
  afterEach(() => {
    localStorage.clear();
    resetOnboarding();
  });

  it("starts not onboarded and persists after marking", () => {
    expect(isOnboarded()).toBe(false);
    markOnboarded();
    expect(isOnboarded()).toBe(true);
    expect(localStorage.getItem("streampay:worker:onboarded")).toBe("1");
  });

  it("stays onboarded for the session even when storage is unavailable", () => {
    const original = Object.getOwnPropertyDescriptor(
      globalThis,
      "localStorage",
    );
    // Simulate private mode: reads and writes throw.
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error("SecurityError");
        },
        setItem: () => {
          throw new Error("SecurityError");
        },
        removeItem: () => {},
      },
    });
    try {
      expect(isOnboarded()).toBe(false);
      markOnboarded(); // does not throw despite storage failing
      // The in-session flag keeps them out of the wizard loop.
      expect(isOnboarded()).toBe(true);
    } finally {
      if (original) {
        Object.defineProperty(globalThis, "localStorage", original);
      }
    }
  });
});
