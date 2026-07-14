import { beforeEach, describe, expect, it } from "vitest";
import {
  getAllEmployerLabels,
  getEmployerLabel,
  setEmployerLabel,
} from "./employerLabels";

const KEY = "streampay:worker:employer-labels";
const A = "GCQGDN634N7LNECZNWXUYHW2OFWNCQRG2CJHLBE4M375CNMXBLL2WKZN";
const B = "GAWCHLI26MZCP4UISX7TSY4SOBRQOKYOANKEQKQWTX4KFFGUYN5LH6V4";

beforeEach(() => {
  localStorage.clear();
});

describe("employer labels", () => {
  it("roundtrips a label per address", () => {
    setEmployerLabel(A, "Acme Co");
    setEmployerLabel(B, "Globex");
    expect(getEmployerLabel(A)).toBe("Acme Co");
    expect(getEmployerLabel(B)).toBe("Globex");
    expect(getEmployerLabel("GUNKNOWN")).toBeNull();
  });

  it("clears a label with an empty name", () => {
    setEmployerLabel(A, "Acme Co");
    setEmployerLabel(A, "  ");
    expect(getEmployerLabel(A)).toBeNull();
  });

  it("ignores an invalid address key", () => {
    setEmployerLabel("not-an-address", "X");
    expect(getAllEmployerLabels()).toEqual({});
  });

  it("drops invalid keys on read and keeps the rest", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ v: 1, labels: { [A]: "Acme Co", bad: "Nope" } }),
    );
    expect(getAllEmployerLabels()).toEqual({ [A]: "Acme Co" });
  });

  it("reads corrupt or wrong-version data as empty", () => {
    localStorage.setItem(KEY, "{{{");
    expect(getAllEmployerLabels()).toEqual({});
    localStorage.setItem(KEY, JSON.stringify({ v: 2, labels: { [A]: "X" } }));
    expect(getAllEmployerLabels()).toEqual({});
  });
});
