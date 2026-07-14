import { NETWORK_LABEL } from "../../lib/config";
import { Badge } from "./Badge";

// The honesty badge that MUST appear on every screen (CLAUDE.md ground rule 2: the
// demo never hides that it runs on testnet with a demo wallet). Extracted here so
// every shell renders the same one and none can forget it.

export function TestnetBadge() {
  return (
    <Badge tone="warning" className="uppercase tracking-wide">
      {NETWORK_LABEL}
    </Badge>
  );
}
