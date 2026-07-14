import { Link } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { ButtonLink } from "../components/ui/Button";

// The front door. A cold visitor lands here (not on the employer dashboard) and
// picks a side. Custom, flat, one teal accent, no gradients (decision 15): a
// headline, the two role doors, a three-step how-it-works, and the honest note.

export function Landing() {
  return (
    <div className="space-y-14">
      <section className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
          Salary streaming on Stellar
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
          Get paid every second you work.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
          An employer sets aside one pay period, and a secure program pays the
          worker automatically, second by second. The worker can cash out what
          they have earned anytime. No loans, no fees, no waiting for payday.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <RoleCard
          eyebrow="For employers"
          title="I pay salaries"
          body="Connect your wallet app, set aside a pay period, and start paying your worker by the second. Stop anytime with a fair split."
          to="/employer"
          cta="Open the employer dashboard"
        />
        <RoleCard
          eyebrow="For workers"
          title="I get paid"
          body="Watch your pay tick up in real time and cash out straight to your account. No crypto knowledge needed to start."
          to="/worker"
          cta="Open the worker app"
        />
      </section>

      <section>
        <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-slate-400">
          How it works
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <StepCard
            step="1"
            title="Set aside once"
            body="The employer funds a whole pay period up front. The money is locked in a secure program, provably there for the worker."
          />
          <StepCard
            step="2"
            title="Wages flow per second"
            body="The worker's earned balance grows every second at the agreed rate. Anyone can check it on the public record."
          />
          <StepCard
            step="3"
            title="Cash out anytime"
            body="The worker takes out any earned amount in about five seconds for a tiny fee, as often as they like."
          />
        </div>
      </section>

      <section className="mx-auto max-w-2xl">
        <Card className="text-center">
          <p className="text-sm text-slate-600">
            This is a live demo on the Stellar test network. It uses test tokens
            in place of USDC and an in-app demo wallet for the worker, so no
            real money moves. Everything else, the streaming contract, the
            per-second accrual, withdrawals, and the fair cancel, is real and
            on-chain.
          </p>
          <p className="mt-4 text-sm">
            <Link
              to="/employer"
              className="font-semibold text-teal-700 hover:text-teal-800"
            >
              Start paying
            </Link>
            <span className="text-slate-300"> · </span>
            <Link
              to="/worker"
              className="font-semibold text-teal-700 hover:text-teal-800"
            >
              Start getting paid
            </Link>
          </p>
        </Card>
      </section>
    </div>
  );
}

function RoleCard({
  eyebrow,
  title,
  body,
  to,
  cta,
}: {
  eyebrow: string;
  title: string;
  body: string;
  to: string;
  cta: string;
}) {
  return (
    <Card className="flex flex-col gap-3 p-6">
      <span className="text-xs font-semibold uppercase tracking-wide text-teal-700">
        {eyebrow}
      </span>
      <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
        {title}
      </h2>
      <p className="text-sm text-slate-600">{body}</p>
      <ButtonLink to={to} size="lg" className="mt-2 w-full">
        {cta}
      </ButtonLink>
    </Card>
  );
}

function StepCard({
  step,
  title,
  body,
}: {
  step: string;
  title: string;
  body: string;
}) {
  return (
    <Card className="flex flex-col gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-50 text-sm font-bold text-teal-700">
        {step}
      </span>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-600">{body}</p>
    </Card>
  );
}
