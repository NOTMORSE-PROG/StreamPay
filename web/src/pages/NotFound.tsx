import { ButtonLink } from "../components/ui/Button";

export function NotFound() {
  return (
    <div className="mx-auto max-w-sm space-y-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-sm text-slate-600">
        That link does not point anywhere in StreamPay.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <ButtonLink to="/employer">For employers</ButtonLink>
        <ButtonLink to="/worker" variant="secondary">
          For workers
        </ButtonLink>
      </div>
    </div>
  );
}
