import { useId, useState, type ReactNode } from "react";

// A small "what does this do" affordance placed next to money actions so both
// sides understand a function before using it (owner mandate 2026-07-12). A round
// "?" toggles a plain-language explanation; disclosure only, no external link.

export function InfoHint({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex items-center align-middle">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold text-slate-500 hover:border-teal-500 hover:text-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
      >
        ?
      </button>
      {open && (
        <span
          id={id}
          role="note"
          className="absolute left-0 top-6 z-20 w-64 rounded-xl border border-slate-200 bg-white p-3 text-xs font-normal leading-relaxed text-slate-600 shadow-lg"
        >
          {children}
        </span>
      )}
    </span>
  );
}
