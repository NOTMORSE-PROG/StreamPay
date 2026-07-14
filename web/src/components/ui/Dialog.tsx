import { useEffect, useRef, type ReactNode } from "react";

// The shared modal shell (WAI-ARIA dialog pattern): a slate backdrop, a centered
// white panel, role="dialog" + aria-modal, focus moved in on open and restored on
// close, Escape and backdrop-click to dismiss, and Tab trapped inside the panel.
// CancelDialog, the create review, and the withdraw confirm all render through it,
// so the accessibility contract lives in exactly one place.

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

export function Dialog({
  title,
  onClose,
  children,
  labelledBy = "dialog-title",
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Move focus into the dialog: the first focusable control, else the panel.
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || panel === null) {
        return;
      }
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && active === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl focus:outline-none"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id={labelledBy}
          className="text-lg font-semibold tracking-tight text-slate-900"
        >
          {title}
        </h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
