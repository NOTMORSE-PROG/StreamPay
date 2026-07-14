import { useState } from "react";
import { getBusinessName, setBusinessName } from "../../lib/employerProfile";
import {
  getSavedWorkers,
  removeWorker,
  saveWorker,
  type SavedWorker,
} from "../../lib/addressBook";
import { explorerAccountUrl } from "../../lib/config";
import { truncateAddress } from "../../lib/format";
import { useEmployerContext } from "../../components/employer/context";
import { NetworkInfo } from "../../components/NetworkInfo";
import { PageHeading } from "../../components/ui/PageHeading";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";

// The employer settings page: the business display name (used in the worker
// invite and the create-success handoff, T-046), the saved-workers manager
// (rename or remove), the network facts, and the app-level sign-out (T-047).

export function EmployerSettings() {
  return (
    <div className="space-y-6">
      <PageHeading
        title="Settings"
        subtitle="Your business name, saved workers, and network."
      />
      <BusinessNameSection />
      <SavedWorkersSection />
      <NetworkInfo />
      <SignOutSection />
    </div>
  );
}

function SignOutSection() {
  const { signOut } = useEmployerContext();
  return (
    <Card className="space-y-3 border-amber-200">
      <h2 className="text-sm font-semibold text-slate-900">Sign out</h2>
      <p className="text-sm text-slate-600">
        This signs you out of StreamPay on this device. Your wallet app itself
        stays connected to this site; to revoke that too, remove the site in
        your wallet app's settings.
      </p>
      <Button variant="quiet-danger" onClick={signOut} className="sm:w-auto">
        Sign out
      </Button>
    </Card>
  );
}

function BusinessNameSection() {
  const [name, setName] = useState(() => getBusinessName() ?? "");
  const [savedName, setSavedName] = useState(name);
  const dirty = name.trim() !== savedName;

  function save(): void {
    setBusinessName(name);
    setSavedName(getBusinessName() ?? "");
  }

  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-900">Business name</h2>
      <p className="text-sm text-slate-500">
        Shown to workers in your invite message and when you hand off a new
        paycheck. Leave it empty to use the default wording.
      </p>
      <input
        aria-label="Business name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Your business or team name"
        maxLength={60}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
      />
      <Button
        variant="secondary"
        disabled={!dirty}
        onClick={save}
        className="sm:w-auto"
      >
        Save name
      </Button>
    </Card>
  );
}

function SavedWorkersSection() {
  const [workers, setWorkers] = useState<SavedWorker[]>(getSavedWorkers);
  const [removing, setRemoving] = useState<SavedWorker | null>(null);

  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-900">Saved workers</h2>
      {workers.length === 0 ? (
        <p className="text-sm text-slate-500">
          No saved workers yet. When you start paying someone you can save them
          so paying them again is one click.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {workers.map((worker) => (
            <WorkerRow
              key={worker.address}
              worker={worker}
              onRename={(name) => setWorkers(saveWorker(name, worker.address))}
              onRemove={() => setRemoving(worker)}
            />
          ))}
        </ul>
      )}
      {removing !== null && (
        <Dialog title="Remove this worker?" onClose={() => setRemoving(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Remove {removing.name} from your saved workers? This only clears
              the saved name on this device; it does not touch any stream.
            </p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setRemoving(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="quiet-danger"
                onClick={() => {
                  setWorkers(removeWorker(removing.address));
                  setRemoving(null);
                }}
                className="flex-1"
              >
                Remove
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </Card>
  );
}

function WorkerRow({
  worker,
  onRename,
  onRemove,
}: {
  worker: SavedWorker;
  onRename: (name: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(worker.name);

  return (
    <li className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            aria-label={`Rename ${worker.name}`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none"
          />
        ) : (
          <p className="truncate text-sm font-medium text-slate-900">
            {worker.name}
          </p>
        )}
        <a
          href={explorerAccountUrl(worker.address)}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs text-slate-500 underline-offset-2 hover:underline"
        >
          {truncateAddress(worker.address, 6)}
        </a>
      </div>
      {editing ? (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            if (name.trim() !== "") {
              onRename(name);
            }
            setEditing(false);
          }}
        >
          Save
        </Button>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          Rename
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={onRemove}>
        Remove
      </Button>
    </li>
  );
}
