import { cx } from "./cx";

// The StreamPay wordmark: the icon tile plus the name. Extracted from the old
// Layout so all three shells (public, employer, worker) show one identical mark.
// `compact` drops the wordmark for the tight worker top bar. The icon file
// matches the app's favicon and home-screen icon (T-016 follow-up, 2026-07-14).

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <img
        src="/icon-192.png"
        alt=""
        aria-hidden="true"
        className="h-7 w-7 rounded-lg"
      />
      <span
        className={cx(
          "text-lg font-semibold tracking-tight text-slate-900",
          compact && "sr-only",
        )}
      >
        StreamPay
      </span>
    </span>
  );
}
