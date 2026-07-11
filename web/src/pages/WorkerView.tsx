import { useParams } from "react-router-dom";

// The worker stream route (/worker/:streamId). The big ticking balance (T-013),
// withdraw button and explorer receipt (T-014), and cancelled/completed end
// states (T-015) mount here. Phone-first by design (the demo shows a real phone).

export function WorkerView() {
  const { streamId } = useParams<{ streamId: string }>();
  return (
    <div className="mx-auto max-w-sm space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your earnings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Stream #{streamId}. Watch it grow, withdraw anytime.
        </p>
      </div>
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="text-sm text-slate-500">
          The live balance and withdraw button arrive here.
        </p>
      </div>
    </div>
  );
}
