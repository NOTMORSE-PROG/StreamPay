import { Link } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";

// The honest answer to "how does this become cash I can spend". It explains the
// currency (the token is USDC in production, a digital dollar; test-XLM stands in
// on this demo) and lays out the real cash-out rails through licensed Stellar
// anchors, each clearly marked a production feature. No fake conversion happens
// here: withdrawals on the demo move test-XLM to the worker's wallet, verifiable
// on the explorer.

const RAILS = [
  {
    title: "Bank transfer",
    body: "Send your balance to your bank account through a licensed local partner. Arrives like any local transfer.",
  },
  {
    title: "E-wallet",
    body: "Cash out to a mobile wallet such as GCash or Maya via a partner in your country.",
  },
  {
    title: "Cash pickup",
    body: "Collect physical cash at a MoneyGram location, 450,000+ across 170+ countries, already connected to the network.",
  },
];

export function CashOut() {
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <Link
          to="/worker/wallet"
          className="text-sm font-medium text-slate-500 hover:text-teal-700"
        >
          &larr; Account
        </Link>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Turning earnings into cash
        </h1>
      </header>

      <Card className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-900">
          What currency is this?
        </h2>
        <p className="text-sm text-slate-600">
          Your pay arrives as a digital US dollar: in the real product that is
          USDC, a dollar-value coin that does not swing in price like other
          digital money. On this test demo, test tokens (test-XLM) stand in for
          it, so no real money moves. Either way, you never need to understand
          any of this to get paid.
        </p>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">
          How you cash out
        </h2>
        {RAILS.map((rail) => (
          <Card key={rail.title} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-900">{rail.title}</span>
              <Badge tone="neutral">Production feature</Badge>
            </div>
            <p className="text-sm text-slate-600">{rail.body}</p>
          </Card>
        ))}
      </section>

      <p className="rounded-xl bg-slate-100 px-4 py-3 text-xs text-slate-500">
        On this demo the cash-out partners are not connected. When you cash out,
        real test tokens move to your account, and you can verify every cash-out
        with its public receipt from your Activity tab.
      </p>
    </div>
  );
}
