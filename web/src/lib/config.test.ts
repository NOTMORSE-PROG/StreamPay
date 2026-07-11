import { describe, expect, it } from "vitest";
import {
  CONTRACT_ID,
  EXPLORER_BASE,
  NETWORK_PASSPHRASE,
  RPC_URL,
  TOKEN_CONTRACT_ID,
  TOKEN_DECIMALS,
  explorerAccountUrl,
  explorerContractUrl,
  explorerTxUrl,
} from "./config";

describe("network config", () => {
  it("points at the deployed testnet contract and token", () => {
    expect(CONTRACT_ID).toBe(
      "CCN6BBCA5PGRXWWYGAEQ4ZLF2QZ3VORKOAGQSETURZINRILNCETB5P3U",
    );
    // Contract strkeys start with C and are 56 chars.
    expect(CONTRACT_ID).toMatch(/^C[A-Z2-7]{55}$/);
    expect(TOKEN_CONTRACT_ID).toMatch(/^C[A-Z2-7]{55}$/);
  });

  it("uses the testnet passphrase and RPC", () => {
    expect(NETWORK_PASSPHRASE).toBe("Test SDF Network ; September 2015");
    expect(RPC_URL).toBe("https://soroban-testnet.stellar.org");
  });

  it("uses 7 token decimals (stroops)", () => {
    expect(TOKEN_DECIMALS).toBe(7);
  });

  it("builds explorer links for the testnet network", () => {
    expect(EXPLORER_BASE).toContain("/testnet");
    expect(explorerTxUrl("abc")).toBe(`${EXPLORER_BASE}/tx/abc`);
    expect(explorerContractUrl(CONTRACT_ID)).toBe(
      `${EXPLORER_BASE}/contract/${CONTRACT_ID}`,
    );
    expect(explorerAccountUrl("GXYZ")).toBe(`${EXPLORER_BASE}/account/GXYZ`);
  });
});
