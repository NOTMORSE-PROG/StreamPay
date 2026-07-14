import { beforeEach, describe, expect, it } from "vitest";
import { getBusinessName, setBusinessName } from "./employerProfile";

const KEY = "streampay:employer:profile";

beforeEach(() => {
  localStorage.clear();
});

describe("employer profile", () => {
  it("roundtrips the business name", () => {
    setBusinessName("Acme Co");
    expect(getBusinessName()).toBe("Acme Co");
  });

  it("trims and clears on an empty name", () => {
    setBusinessName("  Acme Co  ");
    expect(getBusinessName()).toBe("Acme Co");
    setBusinessName("   ");
    expect(getBusinessName()).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("reads corrupt or wrong-version entries as absent", () => {
    localStorage.setItem(KEY, "{{{");
    expect(getBusinessName()).toBeNull();
    localStorage.setItem(KEY, JSON.stringify({ v: 2, businessName: "X" }));
    expect(getBusinessName()).toBeNull();
  });
});
