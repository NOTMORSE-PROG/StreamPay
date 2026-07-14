import { describe, expect, it } from "vitest";
import { GLOSSARY, term, type TermKey } from "./glossary";

const KEYS = Object.keys(GLOSSARY) as TermKey[];

// The lead word must stay free of raw crypto jargon: that is the whole point of
// the module. Explanations may name the technical term honestly; the `plain`
// field may not.
const JARGON_DENYLIST = [
  /xlm/i,
  /testnet/i,
  /blockchain/i,
  /on-?chain/i,
  /soroban/i,
  /stellar/i,
  /freighter/i,
  /stablecoin/i,
];

describe("glossary", () => {
  it("fills all three fields for every key", () => {
    for (const k of KEYS) {
      const e = GLOSSARY[k];
      expect(e.plain.trim().length).toBeGreaterThan(0);
      expect(e.short.trim().length).toBeGreaterThan(0);
      expect(e.explain.trim().length).toBeGreaterThan(0);
    }
  });

  it("resolves every key through term()", () => {
    for (const k of KEYS) {
      expect(term(k)).toBe(GLOSSARY[k]);
    }
  });

  it("uses no em dashes anywhere (owner rule)", () => {
    for (const k of KEYS) {
      const e = GLOSSARY[k];
      for (const field of [e.plain, e.short, e.explain]) {
        expect(field).not.toContain("—");
      }
    }
  });

  it("keeps raw crypto jargon out of the lead word", () => {
    for (const k of KEYS) {
      for (const pattern of JARGON_DENYLIST) {
        expect(GLOSSARY[k].plain).not.toMatch(pattern);
      }
    }
  });
});
