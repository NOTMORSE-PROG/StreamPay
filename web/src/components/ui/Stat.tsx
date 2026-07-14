import type { ReactNode } from "react";
import { Card } from "./Card";
import { cx } from "./cx";

// A labeled figure tile for the dashboard and worker Home summary rows: a small
// uppercase label over a big tabular value, with an optional hint line below.
// Numbers are tabular so a row of tiles stays column-aligned as values tick.

export function Stat({
  label,
  value,
  hint,
  emphasis = false,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <span
        className={cx(
          "font-semibold tabular-nums text-slate-900",
          emphasis ? "text-2xl" : "text-xl",
        )}
      >
        {value}
      </span>
      {hint !== undefined && (
        <span className="text-xs text-slate-500">{hint}</span>
      )}
    </Card>
  );
}
