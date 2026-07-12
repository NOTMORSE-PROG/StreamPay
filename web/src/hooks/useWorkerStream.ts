import { useCallback, useEffect, useMemo, useState } from "react";
import {
  accrued as readAccrued,
  getChainTime,
  getStream,
  type Stream,
} from "../lib/contract";
import { deriveLifecycleState, type LifecycleState } from "../lib/streams";

// The worker view polls its single stream on the same polite ~6 s cadence the
// employer dashboard uses (T-012 research: friendly to the public testnet RPC).
// Each poll re-reads BOTH get_stream and accrued so a cancel by the employer
// flips the worker's screen live (the fair-cancel demo beat, T-015), not just the
// number. Between polls the display smooths locally (accrual.ts); this hook only
// owns the chain anchor (chainAccrued + anchorMs), which is on-chain truth.
const POLL_INTERVAL_MS = 6000;

export interface WorkerStreamState {
  stream: Stream | null;
  /** The last on-chain accrued read in stroops: the I-7 money anchor. */
  chainAccrued: bigint;
  /** Ledger close time (unix seconds) at that read: the smoothing time anchor. */
  anchorLedgerSeconds: bigint;
  /** Date.now() when the anchor landed, so the display can smooth from it. */
  anchorMs: number;
  state: LifecycleState | null;
  loading: boolean;
  /** "invalid" = malformed id in the URL; "load-failed" = first read failed. */
  error: "invalid" | "load-failed" | null;
  /** Date.now() of the last successful read, for the "synced Xs ago" note. */
  lastSyncedMs: number | null;
  /** Force a fresh load (used by the withdraw flow after a successful tx). */
  refresh: () => void;
}

export function useWorkerStream(
  streamId: string | undefined,
): WorkerStreamState {
  const [stream, setStream] = useState<Stream | null>(null);
  const [chainAccrued, setChainAccrued] = useState<bigint>(0n);
  const [anchorLedgerSeconds, setAnchorLedgerSeconds] = useState<bigint>(0n);
  const [anchorMs, setAnchorMs] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"invalid" | "load-failed" | null>(null);
  const [lastSyncedMs, setLastSyncedMs] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // A stream id is a contract u64: only non-negative integer text is valid. A
  // malformed id renders a friendly error, never a crash (acceptance criterion).
  const parsedId = useMemo<bigint | null>(() => {
    if (streamId === undefined || !/^\d+$/.test(streamId)) {
      return null;
    }
    return BigInt(streamId);
  }, [streamId]);

  const refresh = useCallback(() => {
    setRefreshKey((key) => key + 1);
  }, []);

  // Initial load (and on refresh): read the stream and its accrued together. A
  // failure here blocks the view with a friendly message; later poll failures do
  // not (the last good values stay on screen).
  useEffect(() => {
    if (parsedId === null) {
      setError("invalid");
      setLoading(false);
      return;
    }
    let abandoned = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const loaded = await getStream(parsedId);
        const accruedNow = await readAccrued(parsedId);
        const ledgerNow = await getChainTime();
        if (abandoned) {
          return;
        }
        setStream(loaded);
        setChainAccrued(accruedNow);
        setAnchorLedgerSeconds(ledgerNow);
        setAnchorMs(Date.now());
        setLastSyncedMs(Date.now());
        setLoading(false);
      } catch {
        if (abandoned) {
          return;
        }
        setError("load-failed");
        setLoading(false);
      }
    })();
    return () => {
      abandoned = true;
    };
  }, [parsedId, refreshKey]);

  // Poll while the stream is loaded and the tab is visible. On the tab becoming
  // visible again (phone unlock), snap to a fresh read immediately before the
  // display resumes smoothing (Page Visibility API, MDN; T-013 edge case).
  useEffect(() => {
    if (parsedId === null) {
      return;
    }
    const sync = async (): Promise<void> => {
      if (document.hidden) {
        return;
      }
      try {
        const loaded = await getStream(parsedId);
        const accruedNow = await readAccrued(parsedId);
        const ledgerNow = await getChainTime();
        setStream(loaded);
        setChainAccrued(accruedNow);
        setAnchorLedgerSeconds(ledgerNow);
        setAnchorMs(Date.now());
        setLastSyncedMs(Date.now());
      } catch {
        // Keep the last good anchor; the display keeps ticking from it and the
        // "synced Xs ago" note ages, never fabricating a higher figure.
      }
    };
    const interval = setInterval(() => void sync(), POLL_INTERVAL_MS);
    const onVisibility = (): void => {
      if (!document.hidden) {
        void sync();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [parsedId]);

  const state =
    stream === null ? null : deriveLifecycleState(stream, chainAccrued);

  return {
    stream,
    chainAccrued,
    anchorLedgerSeconds,
    anchorMs,
    state,
    loading,
    error,
    lastSyncedMs,
    refresh,
  };
}
