// Pure, synchronous validation for the create-stream form, split out so it is
// unit-tested against known values (TESTING.md boundary-validation standard). The
// async chain checks (worker exists, employer balance) live in the form because
// they need the network; everything decidable from the inputs alone is here.

import { StrKey } from "@stellar/stellar-sdk";
import { AmountParseError, xlmToStroops } from "./format";

export interface CreateStreamInputs {
  workerAddress: string;
  amountText: string;
  durationSeconds: number;
  employerAddress: string;
}

export type ValidationResult =
  | { ok: true; deposit: bigint; durationSeconds: bigint }
  | { ok: false; field: "worker" | "amount" | "duration"; message: string };

/**
 * Validate the create-stream inputs. Rejects malformed worker addresses,
 * non-positive or malformed amounts, non-positive durations, and worker equal to
 * the connected employer. Rejection is total: the first failing field is reported
 * and no partial value is returned (TESTING.md section 5).
 */
export function validateCreateStreamInputs(
  inputs: CreateStreamInputs,
): ValidationResult {
  const worker = inputs.workerAddress.trim();
  if (!StrKey.isValidEd25519PublicKey(worker)) {
    return {
      ok: false,
      field: "worker",
      message: "Enter a valid Stellar address (starts with G).",
    };
  }
  if (worker === inputs.employerAddress) {
    return {
      ok: false,
      field: "worker",
      message: "The worker must be a different account from the employer.",
    };
  }

  let deposit: bigint;
  try {
    deposit = xlmToStroops(inputs.amountText);
  } catch (error) {
    if (error instanceof AmountParseError) {
      return {
        ok: false,
        field: "amount",
        message: "Enter an amount with up to 7 decimals.",
      };
    }
    throw error;
  }
  if (deposit <= 0n) {
    return {
      ok: false,
      field: "amount",
      message: "The amount must be greater than zero.",
    };
  }

  if (
    !Number.isInteger(inputs.durationSeconds) ||
    inputs.durationSeconds <= 0
  ) {
    return {
      ok: false,
      field: "duration",
      message: "The duration must be greater than zero.",
    };
  }

  return { ok: true, deposit, durationSeconds: BigInt(inputs.durationSeconds) };
}

/**
 * The stream's per-second rate in stroops: floor(deposit / duration). This equals
 * the contract's accrued value after exactly one second (floor(1 * deposit /
 * duration)), so the form's rate preview matches the on-chain floor math (T-011
 * acceptance; shared with T-006's fixture values).
 */
export function perSecondStroops(
  deposit: bigint,
  durationSeconds: bigint,
): bigint {
  return deposit / durationSeconds;
}
