// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryStorage, installStorage } from "../test/memoryStorage";
import { wipeWorkerDevice } from "./wipe";

describe("wipeWorkerDevice", () => {
  beforeEach(() => {
    installStorage(new MemoryStorage());
  });

  it("removes every streampay key and leaves foreign keys", () => {
    localStorage.setItem("streampay:demo-wallet:vault", "{}");
    localStorage.setItem("streampay:worker:profile", "{}");
    localStorage.setItem("streampay:receipts:6", "[]");
    localStorage.setItem("streampay:display-currency", "PHP");
    localStorage.setItem("streampay:worker:onboarded", "1");
    localStorage.setItem("streampay:worker:autolock", "off");
    localStorage.setItem("theme", "dark");
    localStorage.setItem("other-app:token", "keep-me");

    wipeWorkerDevice();

    const remaining = (localStorage as unknown as MemoryStorage).keys();
    expect(remaining).toEqual(["theme", "other-app:token"]);
  });

  it("is a no-op when nothing is stored", () => {
    expect(() => wipeWorkerDevice()).not.toThrow();
  });

  it("swallows storage that throws", () => {
    installStorage({
      get length() {
        throw new Error("SecurityError");
      },
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      key: () => null,
    });
    expect(() => wipeWorkerDevice()).not.toThrow();
  });
});
