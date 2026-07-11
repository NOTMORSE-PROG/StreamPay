#![cfg(test)]

//! Adversarial scenario tests, indexed by tests/scenarios/CATALOG.md.
//! Names follow the scNN_<slug> convention; the catalog cites these functions.

use crate::test::{assert_no_stream_state, set_time, setup, token_balance, NOW};
use crate::Error;

#[test]
fn sc01_withdraw_more_than_accrued_rejected() {
    let s = setup(1_000);
    let id = s
        .client
        .create_stream(&s.employer, &s.worker, &s.token, &600, &NOW, &3_600);
    set_time(&s, NOW + 1_800); // accrued 300
    assert_eq!(
        s.client.try_withdraw(&id, &301),
        Err(Ok(Error::WithdrawExceedsAvailable))
    );
    // and beyond the deposit entirely
    assert_eq!(
        s.client.try_withdraw(&id, &601),
        Err(Ok(Error::WithdrawExceedsAvailable))
    );
    assert_eq!(s.client.get_stream(&id).withdrawn, 0);
    assert_eq!(token_balance(&s, &s.worker), 0);
    assert_eq!(token_balance(&s, &s.contract), 600);
}

#[test]
fn sc02_full_drain_at_exhaustion_stays_consistent() {
    let s = setup(1_000);
    let id = s
        .client
        .create_stream(&s.employer, &s.worker, &s.token, &600, &NOW, &3_600);
    set_time(&s, NOW + 3_600); // fully vested
    s.client.withdraw(&id, &600);
    assert_eq!(token_balance(&s, &s.worker), 600);
    assert_eq!(token_balance(&s, &s.contract), 0);
    let stream = s.client.get_stream(&id);
    assert_eq!(stream.withdrawn, 600);
    // accrued - withdrawn == 0 after full drain; one more unit must fail
    assert_eq!(s.client.accrued(&id), 600);
    assert_eq!(
        s.client.try_withdraw(&id, &1),
        Err(Ok(Error::WithdrawExceedsAvailable))
    );
}

#[test]
fn sc09_unauthorized_withdraw_rejected() {
    let s = setup(1_000);
    let id = s
        .client
        .create_stream(&s.employer, &s.worker, &s.token, &600, &NOW, &3_600);
    set_time(&s, NOW + 1_800);
    // no worker authorization present: the require_auth aborts the call
    s.env.set_auths(&[]);
    assert!(s.client.try_withdraw(&id, &100).is_err());
    assert_eq!(token_balance(&s, &s.worker), 0);
    assert_eq!(token_balance(&s, &s.contract), 600);
    assert_eq!(s.client.get_stream(&id).withdrawn, 0);
}

#[test]
fn sc12_accrued_before_start_is_zero_not_underflow() {
    let s = setup(1_000);
    let future_start = NOW + 3_600; // within the 31-day lead tolerance
    let id = s.client.create_stream(
        &s.employer,
        &s.worker,
        &s.token,
        &600,
        &future_start,
        &3_600,
    );
    assert_eq!(s.client.accrued(&id), 0);
    // one second before start: still exactly zero
    set_time(&s, future_start - 1);
    assert_eq!(s.client.accrued(&id), 0);
    // nothing is withdrawable before start either
    assert_eq!(
        s.client.try_withdraw(&id, &1),
        Err(Ok(Error::WithdrawExceedsAvailable))
    );
}

#[test]
fn sc13_repeated_rapid_withdrawals_account_exactly() {
    let s = setup(1_000);
    let id = s
        .client
        .create_stream(&s.employer, &s.worker, &s.token, &600, &NOW, &3_600);
    set_time(&s, NOW + 1_800); // accrued 300
                               // several small withdrawals in the same ledger second
    for _ in 0..10 {
        s.client.withdraw(&id, &25);
    }
    assert_eq!(s.client.get_stream(&id).withdrawn, 250);
    assert_eq!(token_balance(&s, &s.worker), 250);
    // the 11th would cross accrued(300): 250 + 51 > 300
    assert_eq!(
        s.client.try_withdraw(&id, &51),
        Err(Ok(Error::WithdrawExceedsAvailable))
    );
    // exactly the remainder succeeds
    s.client.withdraw(&id, &50);
    assert_eq!(s.client.get_stream(&id).withdrawn, 300);
    assert_eq!(token_balance(&s, &s.worker), 300);
    assert_eq!(token_balance(&s, &s.contract), 300);
}

#[test]
fn sc14_non_advancing_ledger_time_is_consistent() {
    let s = setup(1_000);
    let id = s
        .client
        .create_stream(&s.employer, &s.worker, &s.token, &600, &NOW, &3_600);
    set_time(&s, NOW + 900);
    // same-second calls agree exactly
    let first = s.client.accrued(&id);
    let second = s.client.accrued(&id);
    assert_eq!(first, second);
    assert_eq!(first, 150); // floor(900 * 600 / 3600)
                            // advancing time never decreases the figure
    set_time(&s, NOW + 901);
    assert!(s.client.accrued(&id) >= first);
}

#[test]
fn sc16_earned_funds_never_expire() {
    let s = setup(1_000);
    let id = s
        .client
        .create_stream(&s.employer, &s.worker, &s.token, &600, &NOW, &3_600);
    // the worker goes offline for 30 days past the stream's end
    set_time(&s, NOW + 3_600 + 30 * 86_400);
    assert_eq!(s.client.accrued(&id), 600);
    s.client.withdraw(&id, &600);
    assert_eq!(token_balance(&s, &s.worker), 600);
    assert_eq!(token_balance(&s, &s.contract), 0);
}

#[test]
fn sc03_cancel_at_t0_full_refund() {
    let s = setup(1_000);
    let id = s
        .client
        .create_stream(&s.employer, &s.worker, &s.token, &600, &NOW, &3_600);
    // no time passes: earned 0, the worker leg is a zero-amount transfer
    // (research note 1: the SAC allows it; this test is the empirical proof)
    s.client.cancel(&id);
    assert_eq!(token_balance(&s, &s.worker), 0);
    assert_eq!(token_balance(&s, &s.employer), 1_000);
    assert_eq!(token_balance(&s, &s.contract), 0);
    assert!(s.client.get_stream(&id).cancelled);
    assert_eq!(s.client.accrued(&id), 0);
}

#[test]
fn sc04_cancel_after_full_vesting_pays_worker_everything() {
    let s = setup(1_000);
    let id = s
        .client
        .create_stream(&s.employer, &s.worker, &s.token, &600, &NOW, &3_600);
    set_time(&s, NOW + 7_200); // fully vested, then some
    s.client.cancel(&id);
    // the employer leg is the zero-amount transfer this time
    assert_eq!(token_balance(&s, &s.worker), 600);
    assert_eq!(token_balance(&s, &s.employer), 400);
    assert_eq!(token_balance(&s, &s.contract), 0);
    assert_eq!(s.client.accrued(&id), 600);
}

#[test]
fn sc05_double_cancel_fails_typed_with_no_transfer() {
    let s = setup(1_000);
    let id = s
        .client
        .create_stream(&s.employer, &s.worker, &s.token, &600, &NOW, &3_600);
    set_time(&s, NOW + 1_800);
    s.client.cancel(&id);
    let worker_after = token_balance(&s, &s.worker);
    let employer_after = token_balance(&s, &s.employer);
    assert_eq!(s.client.try_cancel(&id), Err(Ok(Error::StreamCancelled)));
    assert_eq!(token_balance(&s, &s.worker), worker_after);
    assert_eq!(token_balance(&s, &s.employer), employer_after);
    assert_eq!(token_balance(&s, &s.contract), 0);
}

#[test]
fn sc06_withdraw_after_cancel_fails_typed() {
    let s = setup(1_000);
    let id = s
        .client
        .create_stream(&s.employer, &s.worker, &s.token, &600, &NOW, &3_600);
    set_time(&s, NOW + 1_800);
    s.client.cancel(&id);
    // pre-cancel earnings were already paid out by the cancel itself
    assert_eq!(token_balance(&s, &s.worker), 300);
    assert_eq!(
        s.client.try_withdraw(&id, &1),
        Err(Ok(Error::StreamCancelled))
    );
    assert_eq!(token_balance(&s, &s.worker), 300);
}

#[test]
fn sc10_unauthorized_cancel_rejected() {
    let s = setup(1_000);
    let id = s
        .client
        .create_stream(&s.employer, &s.worker, &s.token, &600, &NOW, &3_600);
    set_time(&s, NOW + 1_800);
    // no employer authorization present: the require_auth aborts the call
    s.env.set_auths(&[]);
    assert!(s.client.try_cancel(&id).is_err());
    assert!(!s.client.get_stream(&id).cancelled);
    assert_eq!(token_balance(&s, &s.contract), 600);
    assert_eq!(token_balance(&s, &s.worker), 0);
}

#[test]
fn sc07_garbage_creation_inputs() {
    let s = setup(1_000);
    assert_eq!(
        s.client
            .try_create_stream(&s.employer, &s.worker, &s.token, &0, &NOW, &3_600),
        Err(Ok(Error::DepositNotPositive))
    );
    assert_eq!(
        s.client
            .try_create_stream(&s.employer, &s.worker, &s.token, &-1, &NOW, &3_600),
        Err(Ok(Error::DepositNotPositive))
    );
    assert_eq!(
        s.client
            .try_create_stream(&s.employer, &s.worker, &s.token, &600, &NOW, &0),
        Err(Ok(Error::DurationZero))
    );
    assert_no_stream_state(&s);
    assert_eq!(token_balance(&s, &s.employer), 1_000);
}

#[test]
fn sc08_worker_equals_employer() {
    let s = setup(1_000);
    assert_eq!(
        s.client
            .try_create_stream(&s.employer, &s.employer, &s.token, &600, &NOW, &3_600),
        Err(Ok(Error::WorkerIsEmployer))
    );
    assert_no_stream_state(&s);
    assert_eq!(token_balance(&s, &s.employer), 1_000);
}

/// SC-11 spans creation (T-005), accrual (T-006), and close (T-007), all
/// asserted here: a deposit not divisible by the duration is escrowed
/// exactly, accrues by floor division with the dust held back until vesting,
/// and a mid-stream cancel resolves the dust to the employer with exact
/// conservation (I-5).
#[test]
fn sc11_dusty_deposit_conservation() {
    let s = setup(1_000);
    let id = s
        .client
        .create_stream(&s.employer, &s.worker, &s.token, &100, &NOW, &60);
    assert_eq!(token_balance(&s, &s.contract), 100);
    assert_eq!(s.client.get_stream(&id).deposit, 100);
    // accrual side (T-006): floor division holds the remainder back
    set_time(&s, NOW + 30);
    assert_eq!(s.client.accrued(&id), 50); // floor(30 * 100 / 60)
    set_time(&s, NOW + 59);
    assert_eq!(s.client.accrued(&id), 98); // floor(59 * 100 / 60)
    set_time(&s, NOW + 60);
    assert_eq!(s.client.accrued(&id), 100);
    // close side (T-007): cancel one second before vesting on a fresh dusty
    // stream; the 2 unearned units (the dust) refund to the employer
    let employer_before = token_balance(&s, &s.employer);
    let id2 = s
        .client
        .create_stream(&s.employer, &s.worker, &s.token, &100, &(NOW + 60), &60);
    set_time(&s, NOW + 119); // elapsed 59: earned floor(59 * 100 / 60) = 98
    s.client.cancel(&id2);
    assert_eq!(token_balance(&s, &s.worker), 98);
    // conservation exact: the employer paid 100 and got the 2-unit dust back
    assert_eq!(token_balance(&s, &s.employer), employer_before - 100 + 2);
    // only the first stream's untouched 100-unit escrow remains
    assert_eq!(token_balance(&s, &s.contract), 100);
}
