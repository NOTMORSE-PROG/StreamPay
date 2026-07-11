#![cfg(test)]

//! Property suite (TESTING.md section 4). T-005 holds I-1 at creation: after
//! create_stream the contract's token balance equals the deposit exactly,
//! and the stream records the full deposit with nothing withdrawn. T-006
//! adds I-2 (accrued monotone, capped at deposit) and I-1/I-3 across random
//! withdrawal sequences (withdrawn never exceeds accrued, never exceeds the
//! deposit, over-withdrawals always fail typed). Strategy domains per the
//! standard: deposit in 1..=10^15 smallest units, duration in 1..=10^8
//! seconds, start within the tolerance window, time offsets in 0..=2*10^8
//! seconds (past full vesting).

use crate::test::{set_time, setup, token_balance, NOW};
use crate::Error;
use proptest::prelude::*;

proptest! {
    #![proptest_config(ProptestConfig::with_cases(64))]

    #[test]
    fn i1_at_creation_contract_holds_exact_deposit(
        deposit in 1i128..=1_000_000_000_000_000i128,
        duration in 1u64..=100_000_000u64,
        start_offset in -(crate::MAX_BACKDATE_SECONDS as i64)..=(crate::MAX_LEAD_SECONDS as i64),
    ) {
        let s = setup(deposit);
        let start = NOW.checked_add_signed(start_offset).unwrap();
        let id = s.client.create_stream(
            &s.employer, &s.worker, &s.token, &deposit, &start, &duration,
        );
        let stream = s.client.get_stream(&id);
        prop_assert_eq!(token_balance(&s, &s.contract), deposit);
        prop_assert_eq!(token_balance(&s, &s.employer), 0);
        prop_assert_eq!(stream.deposit, deposit);
        prop_assert_eq!(stream.withdrawn, 0);
        prop_assert!(!stream.cancelled);
    }

    #[test]
    fn i2_accrued_is_monotone_and_capped_at_deposit(
        deposit in 1i128..=1_000_000_000_000_000i128,
        duration in 1u64..=100_000_000u64,
        offsets in proptest::collection::vec(0u64..=200_000_000u64, 1..8),
    ) {
        let s = setup(deposit);
        let id = s.client.create_stream(
            &s.employer, &s.worker, &s.token, &deposit, &NOW, &duration,
        );
        let mut sorted = offsets;
        sorted.sort_unstable();
        let mut previous = 0i128;
        for offset in sorted {
            set_time(&s, NOW + offset);
            let accrued = s.client.accrued(&id);
            prop_assert!(accrued >= previous, "accrued decreased over ledger time");
            prop_assert!(accrued <= deposit, "accrued exceeded the deposit");
            previous = accrued;
        }
        // at or past full vesting the figure is exactly the deposit
        set_time(&s, NOW + duration);
        prop_assert_eq!(s.client.accrued(&id), deposit);
    }

    #[test]
    fn i1_i3_withdrawn_never_exceeds_accrued_or_deposit(
        deposit in 1i128..=1_000_000_000_000_000i128,
        duration in 1u64..=100_000_000u64,
        ops in proptest::collection::vec(
            (0u64..=50_000_000u64, 0u16..=1_000u16), 1..8,
        ),
    ) {
        let s = setup(deposit);
        let id = s.client.create_stream(
            &s.employer, &s.worker, &s.token, &deposit, &NOW, &duration,
        );
        let mut now = NOW;
        let mut total_withdrawn = 0i128;
        for (advance, permille) in ops {
            now += advance;
            set_time(&s, now);
            let accrued = s.client.accrued(&id);
            let available = accrued - total_withdrawn;
            prop_assert!(available >= 0, "withdrawn overtook accrued");

            // any amount beyond available must fail typed, moving nothing
            prop_assert_eq!(
                s.client.try_withdraw(&id, &(available + 1)),
                Err(Ok(Error::WithdrawExceedsAvailable))
            );

            let amount = available * i128::from(permille) / 1_000;
            if amount > 0 {
                s.client.withdraw(&id, &amount);
                total_withdrawn += amount;
            }
            prop_assert!(total_withdrawn <= accrued);
            prop_assert!(total_withdrawn <= deposit);
            prop_assert_eq!(s.client.get_stream(&id).withdrawn, total_withdrawn);
            prop_assert_eq!(token_balance(&s, &s.worker), total_withdrawn);
            prop_assert_eq!(token_balance(&s, &s.contract), deposit - total_withdrawn);
        }
    }

    #[test]
    fn i1_i6_cancel_conserves_exactly_and_strands_nothing(
        deposit in 1i128..=1_000_000_000_000_000i128,
        duration in 1u64..=100_000_000u64,
        ops in proptest::collection::vec(
            (0u64..=50_000_000u64, 0u16..=1_000u16), 0..6,
        ),
        cancel_advance in 0u64..=200_000_000u64,
    ) {
        let s = setup(deposit);
        let id = s.client.create_stream(
            &s.employer, &s.worker, &s.token, &deposit, &NOW, &duration,
        );
        let mut now = NOW;
        let mut total_withdrawn = 0i128;
        for (advance, permille) in ops {
            now += advance;
            set_time(&s, now);
            let available = s.client.accrued(&id) - total_withdrawn;
            let amount = available * i128::from(permille) / 1_000;
            if amount > 0 {
                s.client.withdraw(&id, &amount);
                total_withdrawn += amount;
            }
        }
        now += cancel_advance;
        set_time(&s, now);
        let earned = s.client.accrued(&id);
        s.client.cancel(&id);
        // I-1 exact: worker holds every earned unit, the employer holds the
        // rest (dust included); I-6: nothing stranded in the contract.
        prop_assert_eq!(token_balance(&s, &s.worker), earned);
        prop_assert_eq!(token_balance(&s, &s.employer), deposit - earned);
        prop_assert_eq!(token_balance(&s, &s.contract), 0);
        // the frozen figure and the closed verbs
        prop_assert_eq!(s.client.accrued(&id), earned);
        prop_assert_eq!(
            s.client.try_withdraw(&id, &1),
            Err(Ok(Error::StreamCancelled))
        );
        prop_assert_eq!(s.client.try_cancel(&id), Err(Ok(Error::StreamCancelled)));
    }
}
