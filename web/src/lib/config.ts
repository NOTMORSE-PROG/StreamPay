// The single source of network truth for the whole app (CODE-STANDARDS config
// discipline; ENGINEERING.md decision 6). Nothing else in the codebase hardcodes
// an endpoint, the contract id, or the token address. Redeploying the contract is
// a one-line change here, which is also the production "swap test-XLM for USDC"
// story (ENGINEERING.md decision 5): change TOKEN_CONTRACT_ID and nothing else.

// The deployed StreamPay contract, proven live on testnet in T-008.
export const CONTRACT_ID =
  "CCN6BBCA5PGRXWWYGAEQ4ZLF2QZ3VORKOAGQSETURZINRILNCETB5P3U";

// The token the demo streams: the native-XLM Stellar Asset Contract on testnet.
// Production swaps this one address for a USDC SAC (decision 5).
export const TOKEN_CONTRACT_ID =
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

// Soroban RPC endpoint for testnet reads and submissions.
export const RPC_URL = "https://soroban-testnet.stellar.org";

// The testnet network passphrase (equals stellar-sdk's Networks.TESTNET). Every
// signature and every simulation is bound to this network; the wallet-connect
// flow (T-010) refuses any other network.
export const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

// Human label for the network, shown in the honesty badge on every screen.
export const NETWORK_LABEL = "TESTNET";

// stellar.expert explorer base for testnet; helpers below build tx and contract
// links so the "verify it yourself on-chain" beat is one call away.
export const EXPLORER_BASE = "https://stellar.expert/explorer/testnet";

// The token's smallest-unit precision. Native XLM (and the USDC SAC) use 7
// decimals, so one whole token is 10^7 stroops. Money math converts through this
// exactly once (I-5; see format.ts), never as a float round-trip.
export const TOKEN_DECIMALS = 7;

// Indicative demo conversion rates for the worker's local-currency DISPLAY only
// (currency.ts). These are illustrative, labeled "demo rate" everywhere they show,
// and NEVER feed a transaction: all real money math stays in stroops. Values are a
// rough snapshot on 2026-07-12 and are deliberately not fetched live (an external
// price feed at demo time would be a new failure mode). One test-XLM stands in for
// the streamed token; production would stream USDC (about one US dollar).
export const DEMO_RATE_XLM_TO_USD = 0.11;
export const DEMO_RATE_USD_TO_PHP = 58;

/** Explorer URL for a transaction hash. */
export function explorerTxUrl(hash: string): string {
  return `${EXPLORER_BASE}/tx/${hash}`;
}

/** Explorer URL for a contract id. */
export function explorerContractUrl(contractId: string): string {
  return `${EXPLORER_BASE}/contract/${contractId}`;
}

/** Explorer URL for an account address. */
export function explorerAccountUrl(address: string): string {
  return `${EXPLORER_BASE}/account/${address}`;
}

// Friendbot base URL; also feeds the CSP connect-src (csp.ts), so funding and
// the policy can never disagree about the host.
export const FRIENDBOT_BASE = "https://friendbot.stellar.org";

/**
 * Friendbot funding link for a testnet account (decision 13's one-click funding
 * hint). Testnet only, and labeled as such wherever it appears.
 */
export function friendbotUrl(address: string): string {
  return `${FRIENDBOT_BASE}/?addr=${address}`;
}
