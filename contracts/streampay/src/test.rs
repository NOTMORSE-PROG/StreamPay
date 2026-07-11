#![cfg(test)]

extern crate std;

use crate::{
    DataKey, Error, Stream, StreamCancelled, StreamCreated, StreamPay, StreamPayClient,
    WithdrawalMade,
};
use soroban_sdk::testutils::{Address as _, Events, Ledger};
use soroban_sdk::token::{StellarAssetClient, TokenClient};
use soroban_sdk::{vec, Address, Env, Event};

/// Fixed base ledger time so start/backdate arithmetic is deterministic.
pub(crate) const NOW: u64 = 1_700_000_000;

pub(crate) struct Setup {
    pub env: Env,
    pub client: StreamPayClient<'static>,
    pub contract: Address,
    pub token: Address,
    pub employer: Address,
    pub worker: Address,
}

/// Env with mocked auths, ledger time NOW, a registered native-style SAC
/// token, and `balance` minted to the employer.
pub(crate) fn setup(balance: i128) -> Setup {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|ledger| ledger.timestamp = NOW);

    let contract = env.register(StreamPay, ());
    let client = StreamPayClient::new(&env, &contract);

    let token_admin = Address::generate(&env);
    let token = env
        .register_stellar_asset_contract_v2(token_admin)
        .address();
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);
    if balance > 0 {
        StellarAssetClient::new(&env, &token).mint(&employer, &balance);
    }
    Setup {
        env,
        client,
        contract,
        token,
        employer,
        worker,
    }
}

pub(crate) fn token_balance(s: &Setup, who: &Address) -> i128 {
    TokenClient::new(&s.env, &s.token).balance(who)
}

#[test]
fn create_stream_escrows_deposit_and_stores_stream() {
    let s = setup(1_000);
    let id = s
        .client
        .create_stream(&s.employer, &s.worker, &s.token, &600, &NOW, &3_600);
    assert_eq!(id, 1);
    assert_eq!(token_balance(&s, &s.employer), 400);
    assert_eq!(token_balance(&s, &s.contract), 600);
    assert_eq!(
        s.client.get_stream(&1),
        Stream {
            employer: s.employer.clone(),
            worker: s.worker.clone(),
            token: s.token.clone(),
            deposit: 600,
            start: NOW,
            duration: 3_600,
            withdrawn: 0,
            cancelled: false,
        }
    );
}

#[test]
fn create_stream_emits_creation_event() {
    let s = setup(1_000);
    s.client
        .create_stream(&s.employer, &s.worker, &s.token, &600, &NOW, &3_600);
    let expected = StreamCreated {
        employer: s.employer.clone(),
        worker: s.worker.clone(),
        id: 1,
        token: s.token.clone(),
        deposit: 600,
        start: NOW,
        duration: 3_600,
    };
    assert_eq!(
        s.env.events().all().filter_by_contract(&s.contract),
        std::vec![expected.to_xdr(&s.env, &s.contract)]
    );
}

#[test]
fn stream_ids_are_sequential_and_indexed_per_party() {
    let s = setup(1_000);
    let other_worker = Address::generate(&s.env);
    let id1 = s
        .client
        .create_stream(&s.employer, &s.worker, &s.token, &100, &NOW, &60);
    let id2 = s
        .client
        .create_stream(&s.employer, &other_worker, &s.token, &100, &NOW, &60);
    assert_eq!((id1, id2), (1, 2));
    assert_eq!(
        s.client.streams_by_employer(&s.employer),
        vec![&s.env, 1, 2]
    );
    assert_eq!(s.client.streams_by_worker(&s.worker), vec![&s.env, 1]);
    assert_eq!(s.client.streams_by_worker(&other_worker), vec![&s.env, 2]);
    assert_eq!(
        s.client.streams_by_worker(&s.employer),
        soroban_sdk::Vec::new(&s.env)
    );
}

#[test]
fn missing_employer_auth_rejects_and_leaves_no_state() {
    let s = setup(1_000);
    s.env.set_auths(&[]);
    let result = s
        .client
        .try_create_stream(&s.employer, &s.worker, &s.token, &600, &NOW, &3_600);
    assert!(result.is_err());
    assert_no_stream_state(&s);
    assert_eq!(token_balance(&s, &s.employer), 1_000);
}

#[test]
fn insufficient_employer_balance_rejects_atomically() {
    let s = setup(100);
    let result = s
        .client
        .try_create_stream(&s.employer, &s.worker, &s.token, &600, &NOW, &3_600);
    assert!(result.is_err());
    assert_no_stream_state(&s);
    assert_eq!(token_balance(&s, &s.employer), 100);
}

#[test]
fn non_token_address_rejects_atomically() {
    let s = setup(1_000);
    let not_a_token = Address::generate(&s.env);
    let result =
        s.client
            .try_create_stream(&s.employer, &s.worker, &not_a_token, &600, &NOW, &3_600);
    assert!(result.is_err());
    assert_no_stream_state(&s);
}

#[test]
fn start_beyond_backdate_tolerance_rejects() {
    let s = setup(1_000);
    let too_old = NOW - crate::MAX_BACKDATE_SECONDS - 1;
    assert_eq!(
        s.client
            .try_create_stream(&s.employer, &s.worker, &s.token, &600, &too_old, &3_600),
        Err(Ok(Error::StartTooFarPast))
    );
    let oldest_allowed = NOW - crate::MAX_BACKDATE_SECONDS;
    assert!(s
        .client
        .try_create_stream(
            &s.employer,
            &s.worker,
            &s.token,
            &600,
            &oldest_allowed,
            &3_600
        )
        .is_ok());
}

#[test]
fn start_beyond_lead_tolerance_rejects() {
    let s = setup(1_000);
    let too_far = NOW + crate::MAX_LEAD_SECONDS + 1;
    assert_eq!(
        s.client
            .try_create_stream(&s.employer, &s.worker, &s.token, &600, &too_far, &3_600),
        Err(Ok(Error::StartTooFarFuture))
    );
    let latest_allowed = NOW + crate::MAX_LEAD_SECONDS;
    assert!(s
        .client
        .try_create_stream(
            &s.employer,
            &s.worker,
            &s.token,
            &600,
            &latest_allowed,
            &3_600
        )
        .is_ok());
}

#[test]
fn start_plus_duration_overflow_rejects() {
    let s = setup(1_000);
    // Overflow requires start near u64::MAX, which the lead check would catch
    // first; prove the overflow guard by moving ledger time near the end.
    s.env
        .ledger()
        .with_mut(|ledger| ledger.timestamp = u64::MAX - 10);
    assert_eq!(
        s.client.try_create_stream(
            &s.employer,
            &s.worker,
            &s.token,
            &600,
            &(u64::MAX - 5),
            &3_600
        ),
        Err(Ok(Error::TimeRangeOverflow))
    );
    assert_no_stream_state(&s);
}

#[test]
fn get_stream_unknown_id_is_typed_not_found() {
    let s = setup(0);
    assert_eq!(s.client.try_get_stream(&99), Err(Ok(Error::StreamNotFound)));
}

/// Advance the mocked ledger clock to an absolute unix timestamp.
pub(crate) fn set_time(s: &Setup, timestamp: u64) {
    s.env
        .ledger()
        .with_mut(|ledger| ledger.timestamp = timestamp);
}

/// Flip the stored stream's cancelled flag directly (no cancel verb exists
/// until T-007); proves withdraw's cancelled guard in isolation.
pub(crate) fn force_cancelled(s: &Setup, id: u64) {
    s.env.as_contract(&s.contract, || {
        let key = DataKey::Stream(id);
        let mut stream: Stream = s.env.storage().persistent().get(&key).unwrap();
        stream.cancelled = true;
        s.env.storage().persistent().set(&key, &stream);
    });
}

#[test]
fn accrued_follows_the_floor_formula_fixtures() {
    let s = setup(1_000);
    let id = s
        .client
        .create_stream(&s.employer, &s.worker, &s.token, &600, &NOW, &3_600);
    // elapsed 0: floor(0 * 600 / 3600) = 0
    assert_eq!(s.client.accrued(&id), 0);
    // elapsed 1800: floor(1800 * 600 / 3600) = 300
    set_time(&s, NOW + 1_800);
    assert_eq!(s.client.accrued(&id), 300);
    // elapsed 3600 (fully vested): 600
    set_time(&s, NOW + 3_600);
    assert_eq!(s.client.accrued(&id), 600);
    // far past the end: capped at deposit, never more
    set_time(&s, NOW + 7_200);
    assert_eq!(s.client.accrued(&id), 600);
}

#[test]
fn accrued_floor_division_holds_back_dust_until_the_final_second() {
    let s = setup(1_000);
    // 100 units over 60 s: 100 % 60 != 0, the dust vests only at the end.
    let id = s
        .client
        .create_stream(&s.employer, &s.worker, &s.token, &100, &NOW, &60);
    // elapsed 59: floor(59 * 100 / 60) = floor(98.33) = 98
    set_time(&s, NOW + 59);
    assert_eq!(s.client.accrued(&id), 98);
    // elapsed 60: the last 2 dust units arrive exactly at vesting
    set_time(&s, NOW + 60);
    assert_eq!(s.client.accrued(&id), 100);
}

#[test]
fn accrued_rate_floor_stays_zero_until_a_whole_unit_is_earned() {
    let s = setup(1_000);
    // 10 units over 3600 s: one whole unit takes 360 s to accrue.
    let id = s
        .client
        .create_stream(&s.employer, &s.worker, &s.token, &10, &NOW, &3_600);
    // elapsed 359: floor(359 * 10 / 3600) = floor(0.997) = 0
    set_time(&s, NOW + 359);
    assert_eq!(s.client.accrued(&id), 0);
    // elapsed 360: floor(360 * 10 / 3600) = 1
    set_time(&s, NOW + 360);
    assert_eq!(s.client.accrued(&id), 1);
}

#[test]
fn accrued_unknown_id_is_typed_not_found() {
    let s = setup(0);
    assert_eq!(s.client.try_accrued(&99), Err(Ok(Error::StreamNotFound)));
}

#[test]
fn create_stream_rejects_deposit_times_duration_overflow() {
    let s = setup(0);
    // i128::MAX deposit with duration 2: the accrual product could not fit,
    // so creation is refused up front (research note 1).
    assert_eq!(
        s.client
            .try_create_stream(&s.employer, &s.worker, &s.token, &i128::MAX, &NOW, &2),
        Err(Ok(Error::AccrualOverflow))
    );
    assert_no_stream_state(&s);
}

#[test]
fn withdraw_moves_earned_funds_and_tracks_withdrawn() {
    let s = setup(1_000);
    let id = s
        .client
        .create_stream(&s.employer, &s.worker, &s.token, &600, &NOW, &3_600);
    set_time(&s, NOW + 1_800); // accrued 300
    s.client.withdraw(&id, &200);
    assert_eq!(token_balance(&s, &s.worker), 200);
    assert_eq!(token_balance(&s, &s.contract), 400);
    assert_eq!(s.client.get_stream(&id).withdrawn, 200);
    // the remaining earned 100 is still withdrawable at the same instant
    s.client.withdraw(&id, &100);
    assert_eq!(token_balance(&s, &s.worker), 300);
    assert_eq!(s.client.get_stream(&id).withdrawn, 300);
}

#[test]
fn withdraw_emits_receipt_event() {
    let s = setup(1_000);
    let id = s
        .client
        .create_stream(&s.employer, &s.worker, &s.token, &600, &NOW, &3_600);
    set_time(&s, NOW + 1_800);
    s.client.withdraw(&id, &250);
    let expected = WithdrawalMade {
        worker: s.worker.clone(),
        id,
        amount: 250,
    };
    assert_eq!(
        s.env.events().all().filter_by_contract(&s.contract),
        std::vec![expected.to_xdr(&s.env, &s.contract)]
    );
}

#[test]
fn withdraw_zero_or_negative_amount_rejects() {
    let s = setup(1_000);
    let id = s
        .client
        .create_stream(&s.employer, &s.worker, &s.token, &600, &NOW, &3_600);
    set_time(&s, NOW + 1_800);
    assert_eq!(
        s.client.try_withdraw(&id, &0),
        Err(Ok(Error::WithdrawAmountNotPositive))
    );
    assert_eq!(
        s.client.try_withdraw(&id, &-5),
        Err(Ok(Error::WithdrawAmountNotPositive))
    );
    assert_eq!(s.client.get_stream(&id).withdrawn, 0);
    assert_eq!(token_balance(&s, &s.contract), 600);
}

#[test]
fn withdraw_unknown_stream_is_typed_not_found() {
    let s = setup(0);
    assert_eq!(
        s.client.try_withdraw(&99, &1),
        Err(Ok(Error::StreamNotFound))
    );
}

#[test]
fn withdraw_on_cancelled_stream_rejects() {
    let s = setup(1_000);
    let id = s
        .client
        .create_stream(&s.employer, &s.worker, &s.token, &600, &NOW, &3_600);
    set_time(&s, NOW + 1_800);
    force_cancelled(&s, id);
    assert_eq!(
        s.client.try_withdraw(&id, &1),
        Err(Ok(Error::StreamCancelled))
    );
    assert_eq!(token_balance(&s, &s.worker), 0);
    assert_eq!(token_balance(&s, &s.contract), 600);
}

#[test]
fn withdraw_without_worker_auth_rejects_and_moves_nothing() {
    let s = setup(1_000);
    let id = s
        .client
        .create_stream(&s.employer, &s.worker, &s.token, &600, &NOW, &3_600);
    set_time(&s, NOW + 1_800);
    s.env.set_auths(&[]);
    assert!(s.client.try_withdraw(&id, &100).is_err());
    assert_eq!(token_balance(&s, &s.worker), 0);
    assert_eq!(token_balance(&s, &s.contract), 600);
    assert_eq!(s.client.get_stream(&id).withdrawn, 0);
}

#[test]
fn cancel_mid_stream_splits_fairly_after_a_withdrawal() {
    let s = setup(1_000);
    let id = s
        .client
        .create_stream(&s.employer, &s.worker, &s.token, &600, &NOW, &3_600);
    set_time(&s, NOW + 1_800); // earned 300
    s.client.withdraw(&id, &120);
    s.client.cancel(&id);
    // worker: 120 withdrawn + 180 cancel payout = 300 = everything earned
    assert_eq!(token_balance(&s, &s.worker), 300);
    // employer: 1000 - 600 deposit + 300 refund (the unearned half)
    assert_eq!(token_balance(&s, &s.employer), 700);
    assert_eq!(token_balance(&s, &s.contract), 0);
    let stream = s.client.get_stream(&id);
    assert!(stream.cancelled);
    assert_eq!(stream.withdrawn, 300);
}

#[test]
fn cancel_freezes_accrued_at_the_cancel_instant() {
    let s = setup(1_000);
    let id = s
        .client
        .create_stream(&s.employer, &s.worker, &s.token, &600, &NOW, &3_600);
    set_time(&s, NOW + 1_800);
    s.client.cancel(&id); // earned 300
    set_time(&s, NOW + 3_600); // a live stream would read 600 here
    assert_eq!(s.client.accrued(&id), 300);
}

#[test]
fn cancel_emits_the_split_event() {
    let s = setup(1_000);
    let id = s
        .client
        .create_stream(&s.employer, &s.worker, &s.token, &600, &NOW, &3_600);
    set_time(&s, NOW + 1_800);
    s.client.cancel(&id);
    let expected = StreamCancelled {
        employer: s.employer.clone(),
        worker: s.worker.clone(),
        id,
        worker_amount: 300,
        employer_refund: 300,
    };
    assert_eq!(
        s.env.events().all().filter_by_contract(&s.contract),
        std::vec![expected.to_xdr(&s.env, &s.contract)]
    );
}

#[test]
fn cancel_unknown_stream_is_typed_not_found() {
    let s = setup(0);
    assert_eq!(s.client.try_cancel(&99), Err(Ok(Error::StreamNotFound)));
}

#[test]
fn cancel_without_employer_auth_rejects_and_moves_nothing() {
    let s = setup(1_000);
    let id = s
        .client
        .create_stream(&s.employer, &s.worker, &s.token, &600, &NOW, &3_600);
    set_time(&s, NOW + 1_800);
    s.env.set_auths(&[]);
    assert!(s.client.try_cancel(&id).is_err());
    assert_eq!(token_balance(&s, &s.worker), 0);
    assert_eq!(token_balance(&s, &s.contract), 600);
    assert!(!s.client.get_stream(&id).cancelled);
}

pub(crate) fn assert_no_stream_state(s: &Setup) {
    assert_eq!(s.client.try_get_stream(&1), Err(Ok(Error::StreamNotFound)));
    assert_eq!(
        s.client.streams_by_employer(&s.employer),
        soroban_sdk::Vec::new(&s.env)
    );
    assert_eq!(
        s.client.streams_by_worker(&s.worker),
        soroban_sdk::Vec::new(&s.env)
    );
    assert_eq!(token_balance(s, &s.contract), 0);
}
