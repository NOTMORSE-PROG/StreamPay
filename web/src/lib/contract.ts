// The one and only chain boundary (CODE-STANDARDS: every contract call goes
// through this module; components never import the Stellar SDK directly). T-009
// establishes the module and the read side (free simulations, no wallet, exactly
// the CLI drill's free reads in T-008). The write verbs (create_stream, withdraw,
// cancel) land in T-011 on top of this same server and codec layer.

import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  nativeToScVal,
  rpc,
  scValToNative,
  TransactionBuilder,
  type xdr,
} from "@stellar/stellar-sdk";

import {
  CONTRACT_ID,
  NETWORK_PASSPHRASE,
  RPC_URL,
  TOKEN_CONTRACT_ID,
} from "./config";

/** A failure returned by the RPC or the contract during a read. */
export class ChainError extends Error {}

/**
 * One salary stream as the UI sees it. Mirrors the contract's `Stream` struct
 * (contracts/streampay/src/lib.rs) with the id attached by the caller, since the
 * contract keys streams by id and does not repeat it in the value. Money fields
 * are bigint stroops; times are bigint unix seconds; addresses are strkeys.
 */
export interface Stream {
  id: bigint;
  employer: string;
  worker: string;
  token: string;
  deposit: bigint;
  start: bigint;
  duration: bigint;
  withdrawn: bigint;
  cancelled: boolean;
}

// A valid-format but unfunded placeholder source for read simulations. Simulation
// never submits and never checks this account's sequence or balance, so the
// canonical all-zero account is the standard choice and keeps reads walletless.
// It MUST be a valid ed25519 strkey: the SDK's Account constructor rejects an
// invalid one and every read would throw (regression-guarded in contract.test.ts;
// a wrong checksum tail here was caught by the T-011 live probe).
export const SIMULATION_SOURCE =
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

let cachedServer: rpc.Server | null = null;

/** The shared RPC server (created once). Exposed for the write path in T-011. */
export function getServer(): rpc.Server {
  if (cachedServer === null) {
    cachedServer = new rpc.Server(RPC_URL);
  }
  return cachedServer;
}

/**
 * Build, simulate, and decode a read-only contract call. Returns the decoded
 * return value; throws ChainError on any simulation error (for example calling a
 * read on a stream id that does not exist). No signature, no fee, no submission.
 */
async function simulateRead(
  method: string,
  args: xdr.ScVal[],
): Promise<unknown> {
  const server = getServer();
  const source = new Account(SIMULATION_SOURCE, "0");
  const contract = new Contract(CONTRACT_ID);
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const simulation = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new ChainError(simulation.error);
  }
  const retval = simulation.result?.retval;
  if (retval === undefined) {
    throw new ChainError(`no return value from ${method}`);
  }
  return scValToNative(retval);
}

function u64Arg(value: bigint): xdr.ScVal {
  return nativeToScVal(value, { type: "u64" });
}

function i128Arg(value: bigint): xdr.ScVal {
  return nativeToScVal(value, { type: "i128" });
}

function addressArg(address: string): xdr.ScVal {
  return new Address(address).toScVal();
}

/**
 * Decode a scValToNative Stream object into the typed Stream shape. Exported so
 * the wrapper's decode logic is unit-tested against a known-value fixture
 * (TESTING.md section 2); the full RPC read path is proven live in T-012.
 */
export function decodeStream(id: bigint, raw: unknown): Stream {
  const value = raw as Record<string, unknown>;
  return {
    id,
    employer: String(value.employer),
    worker: String(value.worker),
    token: String(value.token),
    deposit: BigInt(value.deposit as bigint),
    start: BigInt(value.start as bigint),
    duration: BigInt(value.duration as bigint),
    withdrawn: BigInt(value.withdrawn as bigint),
    cancelled: Boolean(value.cancelled),
  };
}

/** Read one stream by id (throws ChainError if it does not exist). */
export async function getStream(id: bigint): Promise<Stream> {
  const raw = await simulateRead("get_stream", [u64Arg(id)]);
  return decodeStream(id, raw);
}

/**
 * Earned-so-far for a stream in stroops on ledger time (the contract's floor
 * accrual). This is on-chain truth; the ticking display only smooths between
 * these reads (decision 3, I-7).
 */
export async function accrued(id: bigint): Promise<bigint> {
  const raw = await simulateRead("accrued", [u64Arg(id)]);
  return BigInt(raw as bigint);
}

/** Ids of every stream this employer created, oldest first. */
export async function streamsByEmployer(employer: string): Promise<bigint[]> {
  const raw = await simulateRead("streams_by_employer", [addressArg(employer)]);
  return (raw as bigint[]).map((id) => BigInt(id));
}

/** Ids of every stream paying this worker, oldest first. */
export async function streamsByWorker(worker: string): Promise<bigint[]> {
  const raw = await simulateRead("streams_by_worker", [addressArg(worker)]);
  return (raw as bigint[]).map((id) => BigInt(id));
}

/**
 * Current ledger close time in unix seconds (chain time). The create form derives
 * a stream's start from this, never the client clock: the dev machine's clock ran
 * ~2.5 min ahead of the ledger in T-008, which would stall the demo ticker
 * (decision 3, T-011 edge case).
 */
export async function getChainTime(): Promise<bigint> {
  const latest = await getServer().getLatestLedger();
  return BigInt(latest.closeTime);
}

/**
 * The address's balance of the streamed token (native XLM SAC) in stroops, read
 * for the employer's pre-submit balance check. Free simulation.
 */
export async function getTokenBalance(address: string): Promise<bigint> {
  const server = getServer();
  const source = new Account(SIMULATION_SOURCE, "0");
  const token = new Contract(TOKEN_CONTRACT_ID);
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(token.call("balance", addressArg(address)))
    .setTimeout(30)
    .build();
  const simulation = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new ChainError(simulation.error);
  }
  const retval = simulation.result?.retval;
  if (retval === undefined) {
    throw new ChainError("no balance returned");
  }
  return BigInt(scValToNative(retval) as bigint);
}

/** Whether an account exists on the network (a worker must exist to be paid). */
export async function accountExists(address: string): Promise<boolean> {
  try {
    await getServer().getAccount(address);
    return true;
  } catch {
    return false;
  }
}

/** The create_stream inputs; `signXdr` is injected so Freighter stays in wallet.ts. */
export interface CreateStreamRequest {
  employer: string;
  worker: string;
  deposit: bigint;
  start: bigint;
  duration: bigint;
  signXdr: (unsignedXdr: string) => Promise<string>;
}

export interface CreateStreamResult {
  streamId: bigint;
  hash: string;
}

/** A submitted transaction failed on-chain or during send. */
export class SubmitError extends Error {}

/**
 * Create a salary stream on-chain: build create_stream, prepare (simulate + fees),
 * hand the XDR to `signXdr` (Freighter), submit, and poll to confirmation. Returns
 * the new stream id and the transaction hash for the explorer receipt. Throws
 * ChainError on a simulation failure (surfaced before signing) and SubmitError on
 * an on-chain failure.
 */
export async function createStream(
  request: CreateStreamRequest,
): Promise<CreateStreamResult> {
  const server = getServer();
  const account = await server.getAccount(request.employer);
  const contract = new Contract(CONTRACT_ID);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "create_stream",
        addressArg(request.employer),
        addressArg(request.worker),
        addressArg(TOKEN_CONTRACT_ID),
        i128Arg(request.deposit),
        u64Arg(request.start),
        u64Arg(request.duration),
      ),
    )
    .setTimeout(180)
    .build();

  // prepareTransaction simulates and assembles the soroban footprint and fees; a
  // simulation failure (for example insufficient balance) throws here, before the
  // wallet ever opens.
  const prepared = await server.prepareTransaction(tx);
  const signedXdr = await request.signXdr(prepared.toXDR());
  const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

  const sent = await server.sendTransaction(signedTx);
  if (sent.status === "ERROR") {
    throw new SubmitError("the network rejected the transaction");
  }
  const confirmed = await pollTransaction(sent.hash);
  const returnValue = confirmed.returnValue;
  if (returnValue === undefined) {
    throw new SubmitError("no stream id returned from create_stream");
  }
  return {
    streamId: BigInt(scValToNative(returnValue) as bigint),
    hash: sent.hash,
  };
}

/** The cancel inputs; `signXdr` is injected so Freighter stays in wallet.ts. */
export interface CancelRequest {
  employer: string;
  streamId: bigint;
  signXdr: (unsignedXdr: string) => string | Promise<string>;
}

/**
 * Cancel a stream (employer-only): build cancel(id) with the EMPLOYER account as
 * the transaction source (its signature satisfies require_auth(employer)),
 * prepare, sign via Freighter, submit, and poll to confirmation. The contract
 * splits the pot atomically (earned to worker, remainder refunded); the caller
 * reads the executed split back from post-cancel state. Returns the transaction
 * hash for the explorer receipt. Throws ChainError on a simulation failure (for
 * example a double-cancel race) before signing, SubmitError on an on-chain fail.
 */
export async function cancelStream(request: CancelRequest): Promise<string> {
  const server = getServer();
  const account = await server.getAccount(request.employer);
  const contract = new Contract(CONTRACT_ID);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call("cancel", u64Arg(request.streamId)))
    .setTimeout(180)
    .build();

  const prepared = await server.prepareTransaction(tx);
  const signedXdr = await request.signXdr(prepared.toXDR());
  const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

  const sent = await server.sendTransaction(signedTx);
  if (sent.status === "ERROR") {
    throw new SubmitError("the network rejected the cancellation");
  }
  await pollTransaction(sent.hash);
  return sent.hash;
}

/** The withdraw inputs; `signXdr` is injected so the demo wallet stays in
 *  demoWallet.ts (the worker's signing boundary, parallel to Freighter). */
export interface WithdrawRequest {
  worker: string;
  streamId: bigint;
  amount: bigint;
  signXdr: (unsignedXdr: string) => string | Promise<string>;
}

/**
 * Withdraw `amount` stroops of earned wages to the worker: build withdraw(id,
 * amount) with the WORKER account as the transaction source (so the tx signature
 * itself satisfies the contract's require_auth(worker), exactly as the CLI drill
 * proved in T-008), prepare (simulate + fees), sign via the injected demo wallet,
 * submit, and poll to confirmation. Returns the transaction hash for the explorer
 * receipt. A simulation failure (for example the amount racing above available)
 * throws ChainError before signing; an on-chain failure throws SubmitError.
 */
export async function withdraw(request: WithdrawRequest): Promise<string> {
  const server = getServer();
  const account = await server.getAccount(request.worker);
  const contract = new Contract(CONTRACT_ID);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "withdraw",
        u64Arg(request.streamId),
        i128Arg(request.amount),
      ),
    )
    .setTimeout(180)
    .build();

  const prepared = await server.prepareTransaction(tx);
  const signedXdr = await request.signXdr(prepared.toXDR());
  const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

  const sent = await server.sendTransaction(signedTx);
  if (sent.status === "ERROR") {
    throw new SubmitError("the network rejected the withdrawal");
  }
  await pollTransaction(sent.hash);
  return sent.hash;
}

/**
 * Poll a submitted transaction until it leaves NOT_FOUND. NOT_FOUND means still
 * pending (never a failure), so a slow confirmation is never misreported; only an
 * explicit FAILED status throws. Times out after ~30 seconds of polling.
 */
async function pollTransaction(
  hash: string,
): Promise<rpc.Api.GetSuccessfulTransactionResponse> {
  const server = getServer();
  const deadline = Date.now() + 30_000;
  for (;;) {
    const response = await server.getTransaction(hash);
    if (response.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return response;
    }
    if (response.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new SubmitError("the transaction failed on-chain");
    }
    if (Date.now() > deadline) {
      throw new SubmitError(
        "timed out waiting for confirmation; check the explorer before retrying",
      );
    }
    await sleep(1000);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
