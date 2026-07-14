# StreamPay contract

A Soroban smart contract that streams salary per second on Stellar. The employer
escrows a full pay period up front; wages vest to the worker linearly, second by
second; the worker withdraws any earned amount at any time; cancelling splits the
pot fairly and automatically (everything earned to the worker, the remainder
refunded to the employer).

Deployed on **Stellar testnet** (this is a hackathon demo; no mainnet, no real
money):

- Contract: `CCN6BBCA5PGRXWWYGAEQ4ZLF2QZ3VORKOAGQSETURZINRILNCETB5P3U`
- Explorer: https://stellar.expert/explorer/testnet/contract/CCN6BBCA5PGRXWWYGAEQ4ZLF2QZ3VORKOAGQSETURZINRILNCETB5P3U

The demo streams the native-XLM Stellar Asset Contract as a stand-in for USDC.
The token is a per-stream `Address` field, so switching to a USDC SAC is
configuration, not a rewrite.

## The interface (the whole surface)

The deployed wasm exports exactly these seven functions, nothing else. The
integration test `streampay/tests/no_admin_surface.rs` builds the real wasm,
reads its export section, and fails if the surface ever changes.

| Function | Auth | What it does |
|---|---|---|
| `create_stream(employer, worker, token, deposit, start, duration) -> u64` | employer | Escrows `deposit` (token smallest unit) into the contract; wages vest linearly over `duration` seconds from `start` (unix seconds). Returns the stream id. |
| `accrued(id) -> i128` | none (free read) | Earned-so-far on ledger time: `floor(min(elapsed, duration) * deposit / duration)` with `elapsed = max(0, now - start)`. Monotonic, capped at the deposit; frozen after cancel. |
| `withdraw(id, amount)` | worker | Pays `amount` of earned-but-unwithdrawn wages to the worker. Any amount, any time, no minimum. |
| `cancel(id)` | employer | The fair split: earned minus already-withdrawn goes to the worker, the rest of the deposit (including floor dust) refunds to the employer; the stream closes holding nothing. |
| `get_stream(id) -> Stream` | none | Read one stream's state. |
| `streams_by_employer(addr) -> Vec<u64>` | none | This employer's stream ids, oldest first. |
| `streams_by_worker(addr) -> Vec<u64>` | none | This worker's stream ids, oldest first. |

## Guarantees by construction

- **No admin surface.** No admin key, no pause, no drain, no upgrade hook.
  Nobody (including the authors) can freeze or take escrowed funds; the surface
  test above makes the claim checkable against the deployed artifact.
- **Full escrow.** A stream is funded in its entirety at creation. It can never
  run dry mid-period and accrual never depends on the employer staying solvent
  or cooperative.
- **Integer money math only.** All amounts are `i128` in the token's smallest
  unit; accrual is floor division; the sub-stroop dust goes to the employer at
  cancel, so every split conserves the deposit exactly.
- **Overflow-safe by validation.** `create_stream` rejects any
  `deposit * duration` that would not fit `i128`, which guarantees the accrual
  product fits for the stream's whole life; ids and time ranges use checked
  arithmetic with typed errors.
- **State before transfers.** Every state change is written before the outbound
  token transfer, and a failing transfer aborts the whole invocation, so no
  partial state can exist.
- **Earned funds never expire.** Withdrawals stay available forever after
  vesting; state TTLs are extended to roughly 30 days on every touch (demo
  horizon; a production deployment schedules TTL bumps).
- **Sanity bounds on start.** A stream may start at most 1 day in the past
  (mid-period onboarding) and at most 31 days in the future (anything later is
  a typo, not payroll).

## Building and testing

Prerequisites: Rust with the `wasm32v1-none` target and stellar-cli.

```
cd streampay
make build   # stellar contract build (wasm artifact)
make test    # build + cargo test
```

The suite covers unit tests, property tests over the invariants (conservation,
monotonic accrual, withdraw cap, no-reclaim-after-earn, integer-only math,
zero-balance-after-cancel), and the adversarial scenario catalog
(over-withdraw, double cancel, unauthorized parties, garbage inputs, dust
conservation, time edges). The catalog lives at `tests/scenarios/CATALOG.md` in
the project root repository.
