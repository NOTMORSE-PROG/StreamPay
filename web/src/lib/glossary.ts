// A single source of plain-language vocabulary so every screen explains the same
// crypto concept the same honest way (owner ask 2026-07-13). Screens lead with the
// `plain` word; the first time a technical term appears they pair it with `short`
// (a parenthetical) or reveal `explain` behind a Term hint. This softens the words,
// it never hides the scope: the honest facts (test mode, test tokens standing in
// for a digital dollar, in-app demo wallet, public receipts) stay in the copy
// (CLAUDE.md ground rule 2). Terminology, not a protocol fact, so no external
// source to drift against; the mapping is the one locked in the approved plan.

export type TermKey =
  | "stream"
  | "wallet"
  | "address"
  | "unit"
  | "freighter"
  | "testnet"
  | "explorer"
  | "contract"
  | "earned"
  | "finished"
  | "deposit"
  | "approve"
  | "withdraw"
  | "backup"
  | "pin"
  | "testFunds"
  | "usdc";

export interface GlossaryEntry {
  /** The human word to lead with. Carries no raw crypto jargon. */
  plain: string;
  /** A short parenthetical gloss, one clause. */
  short: string;
  /** One honest sentence for a Term hint or InfoHint body. */
  explain: string;
}

export const GLOSSARY: Record<TermKey, GlossaryEntry> = {
  stream: {
    plain: "live paycheck",
    short: "pay that arrives every second",
    explain:
      "A stream is your pay arriving a little every second instead of once a month, from money your employer has already set aside for you.",
  },
  wallet: {
    plain: "your account",
    short: "your StreamPay account, no email or password",
    explain:
      "Your account is held in a wallet: it holds your pay and proves the money is yours. There is no email or password, the wallet itself is how you sign in.",
  },
  address: {
    plain: "your account number",
    short: "the code your employer pays to",
    explain:
      "Your account number (called an address) is like a bank account number: you share it with your employer so they can send your pay to you.",
  },
  unit: {
    plain: "test tokens",
    short: "practice money, not real money",
    explain:
      "This demo runs in test mode, so every amount is in test tokens (test-XLM), not real money. In a real launch this would be a digital US dollar.",
  },
  freighter: {
    plain: "your wallet app",
    short: "the browser app that approves payments",
    explain:
      "The wallet app (Freighter) is a free browser add-on that holds the employer account and approves each payment. It is the employer's sign-in.",
  },
  testnet: {
    plain: "test mode",
    short: "a live demo with no real money",
    explain:
      "This is a live demo running on a test network. Everything works for real, but the money is practice money, so nothing can be lost.",
  },
  explorer: {
    plain: "public receipt",
    short: "a public record you can check yourself",
    explain:
      "Every payment leaves a public receipt that anyone can open and verify. Nothing here is hidden or taken on trust.",
  },
  contract: {
    plain: "the automatic payment rule",
    short: "the program that holds the money and pays it out",
    explain:
      "A small program holds the money your employer set aside and pays it out second by second, automatically. No one can quietly change it.",
  },
  earned: {
    plain: "earned so far",
    short: "what you have earned up to now",
    explain:
      "The amount you have earned up to now, ready to move to your account whenever you want.",
  },
  finished: {
    plain: "finished",
    short: "fully paid out",
    explain:
      "This pay period is complete and everything owed has been paid out.",
  },
  deposit: {
    plain: "set aside",
    short: "fund one pay period up front",
    explain:
      "The employer sets aside one pay period of wages up front. It stays locked and is released to the worker over time.",
  },
  approve: {
    plain: "approve",
    short: "confirm the payment in your wallet app",
    explain:
      "You confirm the action once in your wallet app. After that, the pay flows automatically every second.",
  },
  withdraw: {
    plain: "cash out",
    short: "move earned pay to your account",
    explain:
      "Move what you have earned to your account. It arrives in about five seconds for a tiny fee, with a public receipt.",
  },
  backup: {
    plain: "backup code",
    short: "the code that restores your account",
    explain:
      "A private backup code restores your account on another device. Keep it safe: anyone who has it can reach your pay.",
  },
  pin: {
    plain: "PIN",
    short: "the 6-digit code that unlocks the app",
    explain:
      "A 6-digit PIN unlocks the app on this device and keeps your account locked when you step away.",
  },
  testFunds: {
    plain: "free test funds",
    short: "practice money for the demo",
    explain:
      "Free test funds top up a demo account so you can try everything without spending real money.",
  },
  usdc: {
    plain: "a digital US dollar",
    short: "a stablecoin worth about one dollar",
    explain:
      "In a real launch, pay would stream as a digital US dollar (USDC) that you can cash out through a licensed partner. The demo uses test tokens instead.",
  },
};

/** Look up one glossary entry by key. */
export function term(key: TermKey): GlossaryEntry {
  return GLOSSARY[key];
}
