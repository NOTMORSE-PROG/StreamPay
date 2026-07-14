import { useCallback, useEffect, useRef, useState } from "react";
import { accrued, getStream, streamsByWorker } from "../lib/contract";
import { deriveLifecycleState, type StreamRow } from "../lib/streams";

const POLL_INTERVAL_MS = 6000;

export interface WorkerStreams {
  rows: StreamRow[];
  loading: boolean;
  error: string | null;
  lastSyncedMs: number | null;
}

/**
 * Load every stream paying this worker address (id index + get_stream + accrued)
 * and poll accrued on the same polite ~6 s cadence the employer list uses, so the
 * worker Home totals tick with the chain. Mirrors useEmployerStreams but keyed by
 * worker; kept separate so the proven employer hook is untouched (any unification
 * is the T-036 polling restructure). `workerAddress` null means "wallet not ready
 * yet" and holds an empty, non-erroring state.
 */
export function useWorkerStreams(workerAddress: string | null): WorkerStreams {
  const [rows, setRows] = useState<StreamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedMs, setLastSyncedMs] = useState<number | null>(null);
  const idsRef = useRef<bigint[]>([]);

  const load = useCallback(async (): Promise<void> => {
    if (workerAddress === null) {
      return;
    }
    try {
      const ids = await streamsByWorker(workerAddress);
      idsRef.current = ids;
      const loaded = await Promise.all(
        ids.map(async (id) => {
          const stream = await getStream(id);
          const accruedNow = await accrued(id);
          return {
            stream,
            accrued: accruedNow,
            state: deriveLifecycleState(stream, accruedNow),
          };
        }),
      );
      setRows(loaded);
      setError(null);
      setLastSyncedMs(Date.now());
    } catch {
      setError("Could not load your streams from the network. Retrying...");
    } finally {
      setLoading(false);
    }
  }, [workerAddress]);

  useEffect(() => {
    if (workerAddress === null) {
      return;
    }
    setLoading(true);
    void load();
  }, [load, workerAddress]);

  useEffect(() => {
    const tick = async (): Promise<void> => {
      if (document.hidden || idsRef.current.length === 0) {
        return;
      }
      try {
        const updates = await Promise.all(
          idsRef.current.map(async (id) => [id, await accrued(id)] as const),
        );
        const byId = new Map(updates);
        setRows((prev) =>
          prev.map((row) => {
            const next = byId.get(row.stream.id);
            if (next === undefined) {
              return row;
            }
            return {
              ...row,
              accrued: next,
              state: deriveLifecycleState(row.stream, next),
            };
          }),
        );
        setLastSyncedMs(Date.now());
      } catch {
        // Keep the last good values; a flaky read never blanks the screen.
      }
    };
    const interval = setInterval(() => void tick(), POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
    };
  }, [workerAddress]);

  return { rows, loading, error, lastSyncedMs };
}
