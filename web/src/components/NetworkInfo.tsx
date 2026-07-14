import {
  CONTRACT_ID,
  NETWORK_LABEL,
  RPC_URL,
  TOKEN_CONTRACT_ID,
  explorerContractUrl,
} from "../lib/config";
import { truncateAddress } from "../lib/format";
import { Badge } from "./ui/Badge";
import { Card } from "./ui/Card";

// The network facts card shared by both settings pages (T-042 worker, T-046
// employer): which network this build talks to, the streaming and token
// contracts (explorer-linked so every claim is verifiable), and the RPC host.
// Read-only honesty surface; all values come from the single config module.

function ExplorerRow({ label, id }: { label: string; id: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-slate-500">{label}</span>
      <a
        href={explorerContractUrl(id)}
        target="_blank"
        rel="noreferrer"
        className="font-mono text-xs text-teal-700 underline-offset-2 hover:underline"
      >
        {truncateAddress(id, 6)}
      </a>
    </div>
  );
}

export function NetworkInfo() {
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Network</h2>
        <Badge tone="warning">{NETWORK_LABEL}</Badge>
      </div>
      <ExplorerRow label="Automatic payment rule" id={CONTRACT_ID} />
      <ExplorerRow label="Test token (test-XLM)" id={TOKEN_CONTRACT_ID} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500">Network address</span>
        <span className="font-mono text-xs text-slate-700">
          {new URL(RPC_URL).host}
        </span>
      </div>
      <p className="text-xs text-slate-500">
        Everything in this demo runs in test mode with test funds. Every
        paycheck, cash-out, and stop is publicly verifiable with its own
        receipt.
      </p>
    </Card>
  );
}
