import { cx } from "./cx";

// Shared button styling used by both <Button> (native) and <ButtonLink> (router
// Link), kept in a non-component module so importing it never trips the
// react-refresh/only-export-components rule. One teal accent, no gradients
// (decision 15).

export type ButtonVariant = "primary" | "secondary" | "ghost" | "quiet-danger";
export type ButtonSize = "md" | "lg" | "sm";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-teal-600 text-white hover:bg-teal-700",
  secondary:
    "border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:text-slate-900",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  "quiet-danger":
    "border border-amber-300 bg-white text-amber-700 hover:bg-amber-50",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-3 text-base",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  extra?: string,
): string {
  return cx(BASE, VARIANTS[variant], SIZES[size], extra);
}
