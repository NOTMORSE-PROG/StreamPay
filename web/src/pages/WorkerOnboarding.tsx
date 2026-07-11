// The worker pre-stream route (/worker). The demo-wallet creation and address
// handoff (T-023) mount here. Phone-first: this view must read cleanly at 390px
// and never depend on hover or a wide layout (ENGINEERING.md decision 11).

export function WorkerOnboarding() {
  return (
    <div className="mx-auto max-w-sm space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your wallet</h1>
        <p className="mt-1 text-sm text-slate-600">
          Set up a demo wallet, then share its address with your employer to
          start a stream.
        </p>
      </div>
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="text-sm text-slate-500">
          Demo wallet setup and address handoff arrive here.
        </p>
      </div>
    </div>
  );
}
