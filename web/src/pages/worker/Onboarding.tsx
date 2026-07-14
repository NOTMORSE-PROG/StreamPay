import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDemoWallet } from "../../hooks/useDemoWallet";
import { streamsByWorker } from "../../lib/contract";
import { markOnboarded } from "../../lib/onboarding";
import { shareAddressText } from "../../lib/profile";
import { BrandMark } from "../../components/ui/BrandMark";
import { TestnetBadge } from "../../components/ui/TestnetBadge";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button, ButtonLink } from "../../components/ui/Button";
import { QrCode } from "../../components/ui/QrCode";
import { ShareButton } from "../../components/ui/ShareButton";
import { SetPinForm } from "../../components/worker/SetPinForm";

// The worker's first-run wizard (its own screen, no tab bar): welcome, choosing
// a PIN (which creates and encrypts the wallet), the funded wallet, sharing the
// address, then a waiting screen that flips the moment the employer's first
// stream lands. Finishing or skipping marks onboarding done so the gate never
// sends them back here.

const STEPS = 5;
const POLL_MS = 6000;

export function Onboarding() {
  const navigate = useNavigate();
  const { wallet, fundState, createWallet } = useDemoWallet();
  const [step, setStep] = useState(1);
  const [copied, setCopied] = useState(false);
  const [firstStreamId, setFirstStreamId] = useState<bigint | null>(null);

  // On the waiting step, poll for the first stream paying this worker.
  useEffect(() => {
    if (step !== 5 || wallet === null || firstStreamId !== null) {
      return;
    }
    let stopped = false;
    const check = async (): Promise<void> => {
      try {
        const ids = await streamsByWorker(wallet.publicKey);
        if (!stopped && ids.length > 0) {
          setFirstStreamId(ids[0]);
        }
      } catch {
        // keep waiting; a transient read error is not fatal
      }
    };
    void check();
    const interval = setInterval(() => void check(), POLL_MS);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [step, wallet, firstStreamId]);

  function finish(): void {
    markOnboarded();
    void navigate("/worker");
  }

  function openStream(): void {
    markOnboarded();
    if (firstStreamId !== null) {
      void navigate(`/worker/${firstStreamId.toString()}`);
    } else {
      void navigate("/worker");
    }
  }

  function copyAddress(): void {
    if (wallet === null) {
      return;
    }
    void navigator.clipboard.writeText(wallet.publicKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between px-4 py-3">
        <BrandMark />
        <div className="flex items-center gap-3">
          <TestnetBadge />
          <button
            type="button"
            onClick={finish}
            className="text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            Skip
          </button>
        </div>
      </header>

      <div className="px-4">
        <StepDots step={step} />
      </div>

      <main className="flex flex-1 flex-col px-4 py-6">
        {step === 1 && (
          <StepShell
            title="Get paid every second"
            body="StreamPay lets your employer pay you continuously. Your balance goes up every second you are owed, and you can cash out what you have earned anytime. No waiting for payday."
            note="This is a demo running in test mode. It uses test tokens (test-XLM), not real money, so you can try everything safely."
            primary={<Button onClick={() => setStep(2)}>Get started</Button>}
          />
        )}

        {step === 2 && (
          <div className="flex flex-1 flex-col">
            <div className="flex-1 space-y-4">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                Secure your account
              </h1>
              <p className="text-sm text-slate-600">
                Pick a 6-digit PIN. It unlocks the app and keeps your account
                locked on this device, so no one who picks up your phone can
                open it.
              </p>
              <SetPinForm
                submitLabel="Create my account"
                busyLabel="Creating your account"
                onSubmit={async (pin) => {
                  await createWallet(pin);
                  setStep(3);
                }}
              />
              <p className="rounded-xl bg-slate-100 px-4 py-3 text-xs text-slate-500">
                On this test demo a short PIN is for convenience, not bank-grade
                protection. If you forget it, you restore from your backup code.
                The real product uses passkeys (your fingerprint or face).
              </p>
            </div>
          </div>
        )}

        {step === 3 && (
          <StepShell
            title="Your account is ready"
            body="Your account is created and locked with your PIN on this device. There is no backup phrase to write down. It is being set up now."
            note="Your account is where your pay arrives and where your cash-outs land."
            primary={
              <Button onClick={() => setStep(4)}>
                {wallet === null ? "Setting up..." : "Continue"}
              </Button>
            }
            aside={
              <div className="space-y-3">
                <div className="flex justify-center">
                  <Badge
                    tone={fundState === "funded" ? "accent" : "info"}
                    className="uppercase tracking-wide"
                  >
                    {fundState === "funded"
                      ? "Account ready"
                      : "Setting up account"}
                  </Badge>
                </div>
                {wallet !== null && !wallet.persisted && (
                  <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
                    This browser is not saving your account (private mode?). If
                    you reload, this account is lost. Use a normal browser
                    window for the demo.
                  </p>
                )}
              </div>
            }
          />
        )}

        {step === 4 && (
          <StepShell
            title="Share your account number"
            body="Send this account number to your employer so they can start paying you. It is safe to share: only your device can spend from it."
            primary={
              <Button onClick={() => setStep(5)}>I have shared it</Button>
            }
            aside={
              wallet !== null && (
                <Card className="space-y-3">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Your account number
                  </span>
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
                    <Button
                      variant="secondary"
                      onClick={copyAddress}
                      className="flex-1"
                    >
                      {copied ? "Copied" : "Copy number"}
                    </Button>
                    <ShareButton
                      title="My StreamPay account number"
                      text={shareAddressText(wallet.publicKey)}
                    >
                      Share
                    </ShareButton>
                  </div>
                </Card>
              )
            }
          />
        )}

        {step === 5 && (
          <StepShell
            title={
              firstStreamId === null
                ? "Waiting for your first paycheck"
                : "Your pay has started"
            }
            body={
              firstStreamId === null
                ? "Once your employer starts paying you, it appears here and your balance starts ticking up. You can leave this screen open; it updates on its own."
                : "Your employer started paying you. Open it to watch your balance tick up and cash out anytime."
            }
            primary={
              firstStreamId === null ? (
                <Button variant="secondary" onClick={finish}>
                  Go to the app
                </Button>
              ) : (
                <Button onClick={openStream}>Open your paycheck</Button>
              )
            }
            aside={
              firstStreamId === null ? (
                <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 animate-pulse rounded-full bg-teal-500"
                  />
                  Watching for your first paycheck
                </div>
              ) : null
            }
          />
        )}
      </main>

      <footer className="px-4 pb-8 text-center text-xs text-slate-400">
        Already have a StreamPay account on another device?{" "}
        <ButtonLink
          to="/worker/settings"
          variant="ghost"
          size="sm"
          className="px-1 py-0 text-xs text-teal-700"
          onClick={markOnboarded}
        >
          Restore it
        </ButtonLink>
      </footer>
    </div>
  );
}

function StepDots({ step }: { step: number }) {
  return (
    <div className="flex justify-center gap-2 py-2">
      {Array.from({ length: STEPS }, (_, i) => i + 1).map((n) => (
        <span
          key={n}
          className={
            n === step
              ? "h-2 w-6 rounded-full bg-teal-500"
              : n < step
                ? "h-2 w-2 rounded-full bg-teal-300"
                : "h-2 w-2 rounded-full bg-slate-200"
          }
        />
      ))}
    </div>
  );
}

function StepShell({
  title,
  body,
  note,
  primary,
  aside,
}: {
  title: string;
  body: string;
  note?: string;
  primary: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {title}
        </h1>
        <p className="text-sm text-slate-600">{body}</p>
        {aside}
        {note !== undefined && (
          <p className="rounded-xl bg-slate-100 px-4 py-3 text-xs text-slate-500">
            {note}
          </p>
        )}
      </div>
      <div className="pt-6 [&>button]:w-full [&>a]:w-full">{primary}</div>
    </div>
  );
}
