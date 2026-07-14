import { Link, useSearchParams } from "react-router-dom";
import {
  CreateStreamForm,
  type CreateStreamInitial,
} from "../../components/CreateStreamForm";
import { PageHeading } from "../../components/ui/PageHeading";
import { useEmployerContext } from "../../components/employer/context";

// The create-stream route: its own page (not a block on the dashboard) so the
// form has room and the flow reads as a deliberate step. The signed-in employer
// address comes from the shell; a successful create bumps the shared refresh
// counter so the dashboard reflects it when the employer returns. Query params
// prefill the form for the "start next period" renew flow.

function initialFromParams(params: URLSearchParams): CreateStreamInitial {
  const initial: CreateStreamInitial = {};
  const worker = params.get("worker");
  if (worker !== null) {
    initial.worker = worker;
  }
  const amount = params.get("amount");
  if (amount !== null) {
    initial.amount = amount;
  }
  const durationSeconds = Number(params.get("durationSeconds"));
  if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
    if (durationSeconds % 3600 === 0) {
      initial.durationValue = (durationSeconds / 3600).toString();
      initial.durationUnit = "hours";
    } else {
      initial.durationValue = Math.round(durationSeconds / 60).toString();
      initial.durationUnit = "minutes";
    }
  }
  return initial;
}

export function CreateStream() {
  const { address, onChanged } = useEmployerContext();
  const [params] = useSearchParams();
  const initial = initialFromParams(params);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeading
        title="Create a stream"
        subtitle="Fund a whole pay period up front. Wages start accruing to your worker the moment it lands."
        action={
          <Link
            to="/employer"
            className="text-sm font-medium text-slate-600 hover:text-teal-700"
          >
            Back to dashboard
          </Link>
        }
      />
      <CreateStreamForm
        employer={address}
        onCreated={onChanged}
        initial={initial}
      />
    </div>
  );
}
