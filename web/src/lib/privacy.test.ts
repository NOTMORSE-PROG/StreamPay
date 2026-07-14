import { beforeEach, describe, expect, it } from "vitest";
import { HIDDEN_MASK, hiddenOr, isPrivacyOn, setPrivacyOn } from "./privacy";

beforeEach(() => {
  localStorage.clear();
});

describe("privacy preference", () => {
  it("defaults to off and roundtrips", () => {
    expect(isPrivacyOn()).toBe(false);
    setPrivacyOn(true);
    expect(isPrivacyOn()).toBe(true);
    setPrivacyOn(false);
    expect(isPrivacyOn()).toBe(false);
  });

  it("masks only when on", () => {
    expect(hiddenOr("24.65", false)).toBe("24.65");
    expect(hiddenOr("24.65", true)).toBe(HIDDEN_MASK);
  });
});
