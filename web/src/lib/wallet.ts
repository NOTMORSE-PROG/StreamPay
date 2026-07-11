// The one Freighter boundary (mirrors contract.ts for the chain: components never
// import @stellar/freighter-api directly). Wraps the wallet extension's async API
// into typed results and a single connection-state resolver the UI renders from.

import {
  getAddress,
  getNetwork,
  isConnected,
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api";

import { NETWORK_PASSPHRASE } from "./config";

/**
 * The wallet connection state the UI renders. `checking` is the transient load
 * state; the rest are terminal until the user acts or switches network/account.
 */
export type WalletStatus =
  | { kind: "checking" }
  | { kind: "not-installed" }
  | { kind: "disconnected" }
  | { kind: "wrong-network"; network: string }
  | { kind: "connected"; address: string };

/** True iff the Freighter extension is present (handles late injection). */
export async function isInstalled(): Promise<boolean> {
  const result = await isConnected();
  return result.isConnected;
}

/** The connected account address, or "" if the app is not yet authorized. */
async function activeAddress(): Promise<string> {
  const result = await getAddress();
  if (result.error) {
    return "";
  }
  return result.address;
}

/** True iff Freighter's selected network is our configured testnet. */
async function onExpectedNetwork(): Promise<{ ok: boolean; network: string }> {
  const result = await getNetwork();
  if (result.error) {
    return { ok: false, network: "unknown" };
  }
  return {
    ok: result.networkPassphrase === NETWORK_PASSPHRASE,
    network: result.network,
  };
}

/**
 * Resolve the full wallet status: not installed, wrong network, disconnected
 * (installed but unauthorized), or connected. Pure with respect to React so it
 * is unit-tested directly against a mocked Freighter API.
 */
export async function resolveWalletStatus(): Promise<WalletStatus> {
  if (!(await isInstalled())) {
    return { kind: "not-installed" };
  }
  const network = await onExpectedNetwork();
  if (!network.ok) {
    return { kind: "wrong-network", network: network.network };
  }
  const address = await activeAddress();
  if (address === "") {
    return { kind: "disconnected" };
  }
  return { kind: "connected", address };
}

/** An authorization prompt failed (declined, or extension error). */
export class WalletAccessError extends Error {}

/**
 * Prompt the user to authorize the app, then resolve the resulting status.
 * Throws WalletAccessError if the user declines so the caller can show a
 * non-blocking, retryable message.
 */
export async function connectWallet(): Promise<WalletStatus> {
  const result = await requestAccess();
  if (result.error) {
    throw new WalletAccessError(String(result.error));
  }
  return resolveWalletStatus();
}

/** A signing request failed or was declined. */
export class SignError extends Error {}

/**
 * Sign a transaction XDR with Freighter as `address` on the configured network.
 * Returns the signed XDR for submission (used by T-011). Throws SignError on
 * decline or wallet error.
 */
export async function signWithFreighter(
  xdr: string,
  address: string,
): Promise<string> {
  const result = await signTransaction(xdr, {
    networkPassphrase: NETWORK_PASSPHRASE,
    address,
  });
  if (result.error) {
    throw new SignError(String(result.error));
  }
  return result.signedTxXdr;
}
