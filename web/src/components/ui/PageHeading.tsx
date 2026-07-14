import type { ReactNode } from "react";

// The title block every page opens with: an h1 and an optional one-line subtitle,
// with room for an action on the right (a "Create stream" button, a back link).

export function PageHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {title}
        </h1>
        {subtitle !== undefined && (
          <p className="text-sm text-slate-500">{subtitle}</p>
        )}
      </div>
      {action !== undefined && <div className="shrink-0">{action}</div>}
    </div>
  );
}
