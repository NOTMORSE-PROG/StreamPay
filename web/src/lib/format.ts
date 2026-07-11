// The ONE money-conversion module (CODE-STANDARDS: stroop/display conversion lives
// in a single utility with its own unit tests; I-5 forbids floats on money paths).
// Amounts move as bigint stroops everywhere; strings are only for user entry and
// display. No JavaScript number ever touches a money value here, so no float
// rounding can create or destroy a stroop.

import { TOKEN_DECIMALS } from "./config";

const STROOPS_PER_UNIT = 10n ** BigInt(TOKEN_DECIMALS);

/** Thrown when user-entered token text cannot be parsed to exact stroops. */
export class AmountParseError extends Error {}

/**
 * Parse a whole-token amount string (for example "10" or "2.5" test-XLM) into
 * exact stroops. Accepts up to TOKEN_DECIMALS (7) fractional digits; more digits
 * would silently lose precision and are rejected. Rejects empty, negative, and
 * malformed input. This is the only entry from human text to stroops.
 */
export function xlmToStroops(input: string): bigint {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,7})?$/.test(trimmed)) {
    throw new AmountParseError(
      `not a valid amount with up to ${TOKEN_DECIMALS} decimals: "${input}"`,
    );
  }
  const [whole, fraction = ""] = trimmed.split(".");
  const paddedFraction = fraction.padEnd(TOKEN_DECIMALS, "0");
  return BigInt(whole) * STROOPS_PER_UNIT + BigInt(paddedFraction);
}

/**
 * Format stroops as a decimal token string. By default trailing zeros are
 * trimmed for a compact reading ("8.666666"); pass a fixed `fractionDigits` for
 * a stable-width ticker (T-013) that never shifts layout as digits change.
 * `group` inserts thousands separators in the integer part for dashboards.
 */
export function stroopsToXlm(
  stroops: bigint,
  options: { fractionDigits?: number; group?: boolean } = {},
): string {
  const negative = stroops < 0n;
  const magnitude = negative ? -stroops : stroops;
  const wholePart = magnitude / STROOPS_PER_UNIT;
  const fractionPart = magnitude % STROOPS_PER_UNIT;

  let fractionDigits = fractionPart.toString().padStart(TOKEN_DECIMALS, "0");
  if (options.fractionDigits === undefined) {
    fractionDigits = fractionDigits.replace(/0+$/, "");
  } else {
    // Truncate or pad toward the requested width. Truncation (not rounding) keeps
    // the display from ever claiming more than the on-chain figure (I-7).
    fractionDigits = fractionDigits
      .slice(0, options.fractionDigits)
      .padEnd(options.fractionDigits, "0");
  }

  const wholeText = options.group
    ? groupThousands(wholePart.toString())
    : wholePart.toString();
  const sign = negative ? "-" : "";
  return fractionDigits.length > 0
    ? `${sign}${wholeText}.${fractionDigits}`
    : `${sign}${wholeText}`;
}

/** Insert thousands separators into a non-negative integer string. */
export function groupThousands(integerText: string): string {
  return integerText.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Format a duration in seconds as a compact human string (for example "10m", "2h 30m"). */
export function formatDuration(totalSeconds: bigint): string {
  const hours = totalSeconds / 3600n;
  const minutes = (totalSeconds % 3600n) / 60n;
  const seconds = totalSeconds % 60n;
  const parts: string[] = [];
  if (hours > 0n) {
    parts.push(`${hours.toString()}h`);
  }
  if (minutes > 0n) {
    parts.push(`${minutes.toString()}m`);
  }
  if (seconds > 0n && hours === 0n) {
    parts.push(`${seconds.toString()}s`);
  }
  return parts.length > 0 ? parts.join(" ") : "0s";
}

/** Truncate a Stellar address for display, keeping the ends recognizable. */
export function truncateAddress(address: string, edge = 4): string {
  if (address.length <= edge * 2 + 3) {
    return address;
  }
  return `${address.slice(0, edge)}...${address.slice(-edge)}`;
}
