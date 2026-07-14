import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useWorkerContext } from "../../components/worker/context";
import type { FundState } from "../../hooks/useDemoWallet";
import { explorerAccountUrl } from "../../lib/config";
import { shareAddressText } from "../../lib/profile";
import { Card } from "../../components/ui/Card";
import { Badge, type BadgeTone } from "../../components/ui/Badge";
import { Button, ButtonAnchor, ButtonLink } from "../../components/ui/Button";
import { InfoHint } from "../../components/ui/InfoHint";
import { QrCode } from "../../components/ui/QrCode";
import { ShareButton } from "../../components/ui/ShareButton";

// The worker's Wallet tab: their receiving address (to hand the employer), the
// testnet funding status, and the honest demo-wallet explainer. Backup and
// restore moved to the Settings tab (T-042).

const FUND: Record<FundState, { label: string; tone: BadgeTone }> = {
  checking: { label: "Checking", tone: "neutral" },
  funding: { label: "Funding", tone: "info" },
  funded: { label: "Testnet ready", tone: "accent" },
  failed: { label: "Fund later", tone: "warning" },
};

export function WalletTab() {
  const { wallet, fundState, lockState } = useWorkerContext();
  const [copied, setCopied] = useState(false);

  const copyAddress = useCallback(() => {
    if (wallet === null) {
      return;
    }
    void navigator.clipboard.writeText(wallet.publicKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [wallet]);

  if (wallet === null && lockState === "none") {
    return (
      <Card dashed className="mt-6 space-y-3 p-6 text-center">
        <p className="text-sm text-slate-600">
          No account on this device yet. Set one up to get your account number.
        </p>
        <ButtonLink to="/worker/onboarding" className="w-full">
          Set up your account
        </ButtonLink>
      </Card>
    );
  }

  if (wallet === null) {
    return (
      <p className="py-10 text-center text-sm text-slate-500">
        Setting up your account...
      </p>
    );
  }

  const fund = FUND[fundState];

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Your account
        </h1>
        <p className="text-sm text-slate-500">
          Share this account number with your employer so they can pay you.
        </p>
      </header>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
            Your account number
            <InfoHint label="What is this account number">
              This is your account number on the payment network. Your employer
              sends your pay to it, and your cash-outs arrive in it. It is safe
              to share; only your device can spend from it.
            </InfoHint>
          </span>
          <Badge tone={fund.tone}>{fund.label}</Badge>
        </div>
        <div className="flex justify-center rounded-xl bg-slate-50 p-4">
          <QrCode
            value={wallet.publicKey}
            label="QR code of your account number"
          />
        </div>
        <p className="break-all font-mono text-sm text-slate-900">
          {wallet.publicKey}
        </p>
        <div className="flex gap-3">
          <Button onClick={copyAddress} className="flex-1">
            {copied ? "Copied" : "Copy number"}
          </Button>
          <ShareButton
            title="My StreamPay account number"
            text={shareAddressText(wallet.publicKey)}
          >
            Share
          </ShareButton>
          <ButtonAnchor
            href={explorerAccountUrl(wallet.publicKey)}
            target="_blank"
            rel="noreferrer"
            variant="secondary"
          >
            Public record
          </ButtonAnchor>
        </div>
        {fundState === "failed" && (
          <p className="text-xs text-amber-700">
            The free test funds have not arrived yet. Your account still works
            and will be topped up before you cash out. You can add test funds
            again from the public record page.
          </p>
        )}
      </Card>

      {!wallet.persisted && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
          This browser is not saving your account (private mode?). If you
          reload, a new account is created and earlier pay would be stranded.
          Use a normal browser window for the demo.
        </p>
      )}

      <Link
        to="/worker/cashout"
        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-teal-300"
      >
        <div>
          <p className="font-semibold text-slate-900">How do I cash out?</p>
          <p className="text-sm text-slate-500">
            Turn your earnings into pesos, bank, or e-wallet.
          </p>
        </div>
        <span aria-hidden="true" className="text-slate-400">
          &rarr;
        </span>
      </Link>

      <Card className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-900">
          About this account
        </h2>
        <p className="text-sm text-slate-600">
          This is a demo account in test mode. There is no backup phrase and no
          real money; it lives in this browser so you can try the whole thing in
          seconds. In the real product your account is protected by a passkey
          (your fingerprint or face) with proper recovery.
        </p>
        <p className="text-sm text-slate-600">
          Back up or restore this account in{" "}
          <Link
            to="/worker/settings"
            className="font-medium text-teal-700 underline-offset-2 hover:underline"
          >
            Settings
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}
