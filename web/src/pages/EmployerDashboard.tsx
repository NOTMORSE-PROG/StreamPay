import { useState } from "react";
import { useWallet } from "../hooks/useWallet";
import { WalletConnect } from "../components/WalletConnect";
import { CreateStreamForm } from "../components/CreateStreamForm";
import { StreamList } from "../components/StreamList";

// The employer route (/). Owns the wallet connection (T-010) and, once connected,
// hosts the create-stream form (T-011) and the active stream list (T-012). A
// create bumps refreshKey so the list re-reads without a manual refresh.

export function EmployerDashboard() {
  const { status, accessError, connect } = useWallet();
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Employer dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Deposit a pay period once; wages stream to your worker every second.
          </p>
        </div>
        <WalletConnect
          status={status}
          accessError={accessError}
          onConnect={() => void connect()}
        />
      </div>

      {status.kind === "connected" ? (
        <div className="space-y-6">
          <CreateStreamForm
            employer={status.address}
            onCreated={() => setRefreshKey((key) => key + 1)}
          />
          <StreamList employer={status.address} refreshKey={refreshKey} />
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm text-slate-500">
            Connect a wallet to create and monitor salary streams.
          </p>
        </div>
      )}
    </div>
  );
}
