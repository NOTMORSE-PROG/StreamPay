import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getSavedWorkers, removeWorker, saveWorker } from "./addressBook";

const A = "GCQGDN634N7LNECZNWXUYHW2OFWNCQRG2CJHLBE4M375CNMXBLL2WKZN";
const B = "GAWCHLI26MZCP4UISX7TSY4SOBRQOKYOANKEQKQWTX4KFFGUYN5LH6V4";

describe("address book", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("saves and lists workers, newest first", () => {
    saveWorker("Maria", A);
    const list = saveWorker("Ben", B);
    expect(list.map((w) => w.name)).toEqual(["Ben", "Maria"]);
    expect(getSavedWorkers()).toHaveLength(2);
  });

  it("updates by address instead of duplicating", () => {
    saveWorker("Maria", A);
    const list = saveWorker("Maria R.", A);
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Maria R.");
  });

  it("ignores a blank name or invalid address", () => {
    expect(saveWorker("   ", A)).toHaveLength(0);
    expect(saveWorker("Maria", "not-an-address")).toHaveLength(0);
  });

  it("drops corrupt or invalid entries on read", () => {
    localStorage.setItem(
      "streampay:workers",
      JSON.stringify([
        { name: "Good", address: A },
        { name: "Bad", address: "nope" },
        { nonsense: true },
      ]),
    );
    const list = getSavedWorkers();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Good");
  });

  it("survives non-JSON storage", () => {
    localStorage.setItem("streampay:workers", "{not json");
    expect(getSavedWorkers()).toEqual([]);
  });

  it("removes a worker by address", () => {
    saveWorker("Maria", A);
    saveWorker("Ben", B);
    const list = removeWorker(A);
    expect(list.map((w) => w.address)).toEqual([B]);
  });
});
