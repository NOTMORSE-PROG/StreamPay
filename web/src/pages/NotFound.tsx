import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="mx-auto max-w-sm space-y-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-sm text-slate-600">
        That link does not point anywhere in StreamPay.
      </p>
      <Link
        to="/"
        className="inline-flex items-center justify-center rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
