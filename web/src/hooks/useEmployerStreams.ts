import { useCallback, useEffect, useRef, useState } from "react";
import { accrued, getStream, streamsByEmployer } from "../lib/contract";
import { deriveLifecycleState, type StreamRow } from "../lib/streams";

const POLL_INTERVAL_MS = 6000;

export interface EmployerStreams {
  rows: StreamRow[];
  loading: boolean;
  error: string | null;
}

/**
 * Load this employer's streams (id index + per-id get_stream + accrued) and poll
 * accrued on a polite ~6 s cadence so the dashboard figures tick with the chain.
 * Polling pauses when the tab is hidden and is a no-op on a transient read error
 * (the last good values stay on screen). A create bumps refreshKey to re-load.
 */
export function useEmployerStreams(
  employer: string,
  refreshKey: number,
): EmployerStreams {
  const [rows, setRows] = useState<StreamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const idsRef = useRef<bigint[]>([]);

  const load = useCallback(async (): Promise<void> => {
    try {
      const ids = await streamsByEmployer(employer);
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
    } catch {
      setError("Could not load streams from the network. Retrying...");
    } finally {
      setLoading(false);
    }
  }, [employer]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load, refreshKey]);

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
      } catch {
        // Keep the last good values; a flaky read never blanks the dashboard.
      }
    };
    const interval = setInterval(() => void tick(), POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
    };
  }, [employer]);

  return { rows, loading, error };
}
