import type { ReactNode } from "react";
import { cx } from "./cx";

// A small pill label. Four tones map to the app's fixed palette (teal accent,
// blue info, slate neutral, amber warning); nothing else introduces color. Used
// directly for funding/state hints and wrapped by <StatusBadge> for lifecycles.

export type BadgeTone = "accent" | "info" | "neutral" | "warning";

const TONES: Record<BadgeTone, string> = {
  accent: "bg-teal-50 text-teal-700",
  info: "bg-blue-50 text-blue-700",
  neutral: "bg-slate-100 text-slate-600",
  warning: "bg-amber-50 text-amber-700",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
