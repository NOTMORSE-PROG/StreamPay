//! StreamPay: salary streams on Soroban.
//!
//! An employer escrows a full pay period up front; wages accrue to the worker
//! per second by floor division; the worker withdraws any earned amount at any
//! time; cancelling splits the pot fairly (earned to worker, remainder back to
//! the employer). No admin keys, no pause, no drain, no upgrade hook exist by
//! design (ENGINEERING.md decision 17). All amounts are i128 in the token's
//! smallest unit (stroops for native XLM); all times are u64 unix seconds of
//! ledger close.
#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, Env, Vec,
};

/// Streams may start at most this many seconds in the past (one day), so a
/// mid-period hire can be onboarded without a fat-fingered date instantly
/// vesting a large amount.
const MAX_BACKDATE_SECONDS: u64 = 86_400;

/// Streams may start at most this many seconds in the future (31 days): a
/// stream nobody can watch accrue within the month is a typo, not payroll.
const MAX_LEAD_SECONDS: u64 = 2_678_400;

/// TTL target for all contract state: 518,400 ledgers is about 30 days at 5s
/// per ledger. Persistent entries only get hours of minimum TTL at creation,
/// so without this extension a stream could archive before the demo runs
/// (T-005 research note 2).
const TTL_EXTEND_TO_LEDGERS: u32 = 518_400;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum Error {
    DepositNotPositive = 1,
    DurationZero = 2,
    WorkerIsEmployer = 3,
    StartTooFarPast = 4,
    StartTooFarFuture = 5,
    TimeRangeOverflow = 6,
    StreamNotFound = 7,
    IdOverflow = 8,
    AccrualOverflow = 9,
    WithdrawAmountNotPositive = 10,
    WithdrawExceedsAvailable = 11,
    StreamCancelled = 12,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Instance storage: the next stream id to assign (u64, starts at 1).
    NextId,
    /// Persistent: one Stream per id.
    Stream(u64),
    /// Persistent: ids of streams created by this employer (UI list source;
    /// events cannot serve enumeration, RPC retains them for only ~24h).
    EmployerStreams(Address),
    /// Persistent: ids of streams paying this worker.
    WorkerStreams(Address),
}

/// One salary stream. `deposit` and `withdrawn` are in the token's smallest
/// unit; `start` is unix seconds; `duration` is seconds.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Stream {
    pub employer: Address,
    pub worker: Address,
    pub token: Address,
    pub deposit: i128,
    pub start: u64,
    pub duration: u64,
    pub withdrawn: i128,
    pub cancelled: bool,
}

/// Emitted once per creation as a receipt and UX signal. Stream enumeration
/// never reads events (RPC retains them ~24h); it reads the party indexes.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StreamCreated {
    #[topic]
    pub employer: Address,
    #[topic]
    pub worker: Address,
    pub id: u64,
    pub token: Address,
    pub deposit: i128,
    pub start: u64,
    pub duration: u64,
}

/// Emitted once per withdrawal: the worker's receipt (T-014's explorer beat).
/// `amount` is in the token's smallest unit.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WithdrawalMade {
    #[topic]
    pub worker: Address,
    pub id: u64,
    pub amount: i128,
}

/// Emitted once per cancel with both legs of the fair split, in the token's
/// smallest unit, so the UI shows the split from one receipt.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StreamCancelled {
    #[topic]
    pub employer: Address,
    #[topic]
    pub worker: Address,
    pub id: u64,
    pub worker_amount: i128,
    pub employer_refund: i128,
}

#[contract]
pub struct StreamPay;

#[contractimpl]
impl StreamPay {
    /// Create a salary stream: the employer's `deposit` (token smallest unit)
    /// is escrowed into the contract and vests to `worker` linearly over
    /// `duration` seconds starting at `start` (unix seconds). Returns the new
    /// stream id. Requires the employer's authorization for both the call and
    /// the token transfer.
    pub fn create_stream(
        env: Env,
        employer: Address,
        worker: Address,
        token: Address,
        deposit: i128,
        start: u64,
        duration: u64,
    ) -> Result<u64, Error> {
        employer.require_auth();

        if deposit <= 0 {
            return Err(Error::DepositNotPositive);
        }
        if duration == 0 {
            return Err(Error::DurationZero);
        }
        if worker == employer {
            return Err(Error::WorkerIsEmployer);
        }
        let now = env.ledger().timestamp();
        if start < now.saturating_sub(MAX_BACKDATE_SECONDS) {
            return Err(Error::StartTooFarPast);
        }
        if start > now.saturating_add(MAX_LEAD_SECONDS) {
            return Err(Error::StartTooFarFuture);
        }
        if start.checked_add(duration).is_none() {
            return Err(Error::TimeRangeOverflow);
        }
        // Guarantees the accrual product deposit * elapsed fits i128 for the
        // stream's whole life, because elapsed never exceeds duration; the
        // read path then needs no fallible arithmetic (T-006 research note 1).
        if deposit.checked_mul(duration as i128).is_none() {
            return Err(Error::AccrualOverflow);
        }

        // Escrow the full pay period up front (decision 14). A failed
        // transfer aborts the whole invocation, so no partial state exists.
        token::Client::new(&env, &token).transfer(
            &employer,
            env.current_contract_address(),
            &deposit,
        );

        let id = next_id(&env)?;
        let stream = Stream {
            employer: employer.clone(),
            worker: worker.clone(),
            token: token.clone(),
            deposit,
            start,
            duration,
            withdrawn: 0,
            cancelled: false,
        };
        let storage = env.storage().persistent();
        let stream_key = DataKey::Stream(id);
        storage.set(&stream_key, &stream);
        storage.extend_ttl(&stream_key, TTL_EXTEND_TO_LEDGERS, TTL_EXTEND_TO_LEDGERS);
        push_index(&env, DataKey::EmployerStreams(employer.clone()), id);
        push_index(&env, DataKey::WorkerStreams(worker.clone()), id);
        env.storage()
            .instance()
            .extend_ttl(TTL_EXTEND_TO_LEDGERS, TTL_EXTEND_TO_LEDGERS);

        StreamCreated {
            employer,
            worker,
            id,
            token,
            deposit,
            start,
            duration,
        }
        .publish(&env);
        Ok(id)
    }

    /// Read one stream by id.
    pub fn get_stream(env: Env, id: u64) -> Result<Stream, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Stream(id))
            .ok_or(Error::StreamNotFound)
    }

    /// Earned-so-far for a stream, in the token's smallest unit, on ledger
    /// time: floor(min(elapsed, duration) * deposit / duration) with
    /// elapsed = max(0, now - start). Read-only, free to query, monotonically
    /// non-decreasing and capped at the deposit (I-2). Withdrawals are
    /// tracked separately and do not reduce this figure. After cancel the
    /// figure freezes at the amount earned by the cancel instant (which
    /// cancel records as `withdrawn`, all of it already paid out).
    pub fn accrued(env: Env, id: u64) -> Result<i128, Error> {
        let stream = Self::get_stream(env.clone(), id)?;
        if stream.cancelled {
            return Ok(stream.withdrawn);
        }
        Ok(accrued_amount(&stream, env.ledger().timestamp()))
    }

    /// Withdraw `amount` (token smallest unit) of earned wages to the worker.
    /// Worker-only; any amount up to accrued minus already-withdrawn, any
    /// time, no minimum, no fee beyond the network fee. Fails typed on a
    /// cancelled or unknown stream (I-3).
    pub fn withdraw(env: Env, id: u64, amount: i128) -> Result<(), Error> {
        let mut stream = Self::get_stream(env.clone(), id)?;
        if stream.cancelled {
            return Err(Error::StreamCancelled);
        }
        stream.worker.require_auth();

        if amount <= 0 {
            return Err(Error::WithdrawAmountNotPositive);
        }
        let now = env.ledger().timestamp();
        // withdrawn never exceeds accrued (I-3 held on every prior write),
        // so available is never negative.
        let available = accrued_amount(&stream, now) - stream.withdrawn;
        if amount > available {
            return Err(Error::WithdrawExceedsAvailable);
        }

        // amount <= available = accrued - withdrawn, so the sum stays within
        // accrued and therefore within the i128 deposit: no overflow.
        stream.withdrawn += amount;
        let storage = env.storage().persistent();
        let stream_key = DataKey::Stream(id);
        storage.set(&stream_key, &stream);
        storage.extend_ttl(&stream_key, TTL_EXTEND_TO_LEDGERS, TTL_EXTEND_TO_LEDGERS);
        env.storage()
            .instance()
            .extend_ttl(TTL_EXTEND_TO_LEDGERS, TTL_EXTEND_TO_LEDGERS);

        // State is written before the outbound transfer (T-006 research
        // note 6); a failing transfer still aborts the whole invocation.
        token::Client::new(&env, &stream.token).transfer(
            &env.current_contract_address(),
            stream.worker.clone(),
            &amount,
        );

        WithdrawalMade {
            worker: stream.worker,
            id,
            amount,
        }
        .publish(&env);
        Ok(())
    }

    /// Cancel a stream with the fair split: everything earned to date (minus
    /// what the worker already withdrew) is paid to the worker, the rest of
    /// the deposit (including any floor-division dust) refunds to the
    /// employer, and the stream closes holding nothing (I-1, I-6).
    /// Employer-only; a cancelled stream cannot be cancelled again.
    pub fn cancel(env: Env, id: u64) -> Result<(), Error> {
        let mut stream = Self::get_stream(env.clone(), id)?;
        if stream.cancelled {
            return Err(Error::StreamCancelled);
        }
        stream.employer.require_auth();

        let earned = accrued_amount(&stream, env.ledger().timestamp());
        // withdrawn never exceeds earned (I-3 held on every withdraw) and
        // earned never exceeds deposit (the accrual cap), so both legs are
        // non-negative and sum to deposit - withdrawn, exactly what the
        // contract still holds for this stream.
        let worker_amount = earned - stream.withdrawn;
        let employer_refund = stream.deposit - earned;

        // Freeze the stream before any transfer: withdrawn = earned makes
        // the final earned figure readable from state alone (research note
        // 4) and available stays zero forever.
        stream.withdrawn = earned;
        stream.cancelled = true;
        let storage = env.storage().persistent();
        let stream_key = DataKey::Stream(id);
        storage.set(&stream_key, &stream);
        storage.extend_ttl(&stream_key, TTL_EXTEND_TO_LEDGERS, TTL_EXTEND_TO_LEDGERS);
        env.storage()
            .instance()
            .extend_ttl(TTL_EXTEND_TO_LEDGERS, TTL_EXTEND_TO_LEDGERS);

        // Both legs run unconditionally; a zero-amount SAC transfer succeeds
        // (research note 1) and both zero edges are pinned by SC-03/SC-04.
        let token_client = token::Client::new(&env, &stream.token);
        token_client.transfer(
            &env.current_contract_address(),
            stream.worker.clone(),
            &worker_amount,
        );
        token_client.transfer(
            &env.current_contract_address(),
            stream.employer.clone(),
            &employer_refund,
        );

        StreamCancelled {
            employer: stream.employer,
            worker: stream.worker,
            id,
            worker_amount,
            employer_refund,
        }
        .publish(&env);
        Ok(())
    }

    /// Ids of every stream this employer created, oldest first.
    pub fn streams_by_employer(env: Env, employer: Address) -> Vec<u64> {
        read_index(&env, DataKey::EmployerStreams(employer))
    }

    /// Ids of every stream paying this worker, oldest first.
    pub fn streams_by_worker(env: Env, worker: Address) -> Vec<u64> {
        read_index(&env, DataKey::WorkerStreams(worker))
    }
}

/// Earned-so-far at `now` (unix seconds): floor(elapsed * deposit / duration)
/// with elapsed clamped to [0, duration]. The product fits i128 because
/// create_stream rejects any deposit * duration that would not (research
/// note 1), and duration is never 0 by the same validation.
fn accrued_amount(stream: &Stream, now: u64) -> i128 {
    let elapsed = now.saturating_sub(stream.start).min(stream.duration);
    stream.deposit * elapsed as i128 / stream.duration as i128
}

fn next_id(env: &Env) -> Result<u64, Error> {
    let storage = env.storage().instance();
    let id: u64 = storage.get(&DataKey::NextId).unwrap_or(1);
    let next = id.checked_add(1).ok_or(Error::IdOverflow)?;
    storage.set(&DataKey::NextId, &next);
    Ok(id)
}

fn push_index(env: &Env, key: DataKey, id: u64) {
    let storage = env.storage().persistent();
    let mut ids: Vec<u64> = storage.get(&key).unwrap_or_else(|| Vec::new(env));
    ids.push_back(id);
    storage.set(&key, &ids);
    storage.extend_ttl(&key, TTL_EXTEND_TO_LEDGERS, TTL_EXTEND_TO_LEDGERS);
}

fn read_index(env: &Env, key: DataKey) -> Vec<u64> {
    env.storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env))
}

#[cfg(test)]
mod test;
#[cfg(test)]
mod test_properties;
#[cfg(test)]
mod test_scenarios;
