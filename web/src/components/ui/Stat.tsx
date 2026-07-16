import type { ReactNode } from "react";
import { Card } from "./Card";
import { cx } from "./cx";

// A labeled figure tile for the dashboard and worker Home summary rows: a small
// uppercase label over a big tabular value, with an optional small unit beside
// it and an optional hint line below. Numbers are tabular so a row of tiles
// stays column-aligned as values tick. The tile is overflow-hardened (T-055):
// min-w-0 lets it shrink inside a grid and long values wrap instead of
// stretching the card.

export function Stat({
  label,
  value,
  unit,
  hint,
  emphasis = false,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <Card className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <span className="flex min-w-0 flex-wrap items-baseline gap-x-1">
        <span
          className={cx(
            "min-w-0 break-words font-semibold tabular-nums text-slate-900",
            emphasis ? "text-2xl" : "text-xl",
          )}
        >
          {value}
        </span>
        {unit !== undefined && (
          <span className="text-sm font-medium text-slate-400">{unit}</span>
        )}
      </span>
      {hint !== undefined && (
        <span className="text-xs text-slate-500">{hint}</span>
      )}
    </Card>
  );
}
