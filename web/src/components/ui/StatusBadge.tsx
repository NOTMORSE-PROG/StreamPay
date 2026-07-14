import { Badge, type BadgeTone } from "./Badge";
import { lifecycleLabel, type LifecycleState } from "../../lib/streams";

// The single source for lifecycle badges, replacing the three duplicated maps that
// lived in StreamList, WorkerView, and WorkerOnboarding. Tone is fixed per state;
// the worker context relabels "active" as "Getting paid" (the worker reads it as
// their pay flowing, not an admin status), everything else shares one label.

const TONE: Record<LifecycleState, BadgeTone> = {
  active: "accent",
  completed: "info",
  drained: "neutral",
  cancelled: "warning",
};

export function StatusBadge({
  state,
  context = "employer",
}: {
  state: LifecycleState;
  context?: "employer" | "worker";
}) {
  const label =
    context === "worker" && state === "active"
      ? "Getting paid"
      : lifecycleLabel(state);
  return <Badge tone={TONE[state]}>{label}</Badge>;
}
