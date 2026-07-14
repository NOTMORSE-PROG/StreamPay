import { beforeEach, describe, expect, it } from "vitest";
import {
  avatarInitial,
  getWorkerProfile,
  setWorkerName,
  shareAddressText,
} from "./profile";

const PROFILE_KEY = "streampay:worker:profile";
const ADDRESS = "GCQGDN634N7LNECZNWXUYHW2OFWNCQRG2CJHLBE4M375CNMXBLL2WKZN";

beforeEach(() => {
  localStorage.clear();
});

describe("worker profile", () => {
  it("roundtrips a name", () => {
    setWorkerName("Maria");
    expect(getWorkerProfile()).toEqual({ name: "Maria" });
  });

  it("trims and treats whitespace-only as clearing", () => {
    setWorkerName("  Maria  ");
    expect(getWorkerProfile()).toEqual({ name: "Maria" });
    setWorkerName("   ");
    expect(getWorkerProfile()).toBeNull();
    expect(localStorage.getItem(PROFILE_KEY)).toBeNull();
  });

  it("reads corrupt or wrong-version entries as absent", () => {
    localStorage.setItem(PROFILE_KEY, "{{{");
    expect(getWorkerProfile()).toBeNull();
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ v: 2, name: "X" }));
    expect(getWorkerProfile()).toBeNull();
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ v: 1, name: 7 }));
    expect(getWorkerProfile()).toBeNull();
  });

  it("survives storage that throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    };
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      value: broken,
      configurable: true,
    });
    try {
      expect(getWorkerProfile()).toBeNull();
      expect(() => setWorkerName("Maria")).not.toThrow();
    } finally {
      if (original) Object.defineProperty(window, "localStorage", original);
    }
  });
});

describe("avatarInitial", () => {
  it("uppercases the first letter", () => {
    expect(avatarInitial("maria")).toBe("M");
  });

  it("keeps a non-ASCII first grapheme whole", () => {
    expect(avatarInitial("維克多")).toBe("維");
  });

  it("is empty for an empty name", () => {
    expect(avatarInitial("  ")).toBe("");
  });
});

describe("shareAddressText", () => {
  it("omits the name cleanly when unset", () => {
    expect(shareAddressText(ADDRESS)).toBe(
      `Pay me with StreamPay. My wallet address: ${ADDRESS}`,
    );
  });

  it("weaves the name in when set", () => {
    setWorkerName("Maria");
    expect(shareAddressText(ADDRESS)).toBe(
      `Pay me with StreamPay. I am Maria. My wallet address: ${ADDRESS}`,
    );
  });
});
