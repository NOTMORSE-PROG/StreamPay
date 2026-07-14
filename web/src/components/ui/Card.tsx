import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

// The one surface used across the app: a white, softly rounded, hairline-bordered
// panel (decision 15: neutral surface, no gradient). `dashed` is the empty-state
// variant; `padded` toggles the default inner padding off for full-bleed content.

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  dashed?: boolean;
  padded?: boolean;
  children: ReactNode;
}

export function Card({
  dashed = false,
  padded = true,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cx(
        "rounded-2xl bg-white",
        dashed
          ? "border border-dashed border-slate-300"
          : "border border-slate-200",
        padded && "p-5",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
