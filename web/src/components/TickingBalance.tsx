import { useLayoutEffect, useRef } from "react";
import { smoothedAccrued } from "../lib/accrual";
import { stroopsToXlm } from "../lib/format";
import type { Stream } from "../lib/contract";

// The hero of the whole product: one big number, the worker's earned-and-
// available wages, ticking upward in real time. Performance mandate (T-013,
// owner low-end-phone gate): the tick writes text content ONLY, exactly one DOM
// write per animation frame via requestAnimationFrame, no React state per frame
// (a per-frame setState would re-render the tree), no layout-shifting effects.
// The span keeps a fixed 7-decimal width (tabular numerals) so digits changing
// never nudge the layout. When the stream is no longer active, ticking stops and
// the number holds at the on-chain figure (Completed/Drained/Cancelled).

interface TickingBalanceProps {
  stream: Stream;
  /** Last on-chain accrued read in stroops (the frozen value when not ticking). */
  chainAccrued: bigint;
  /** Ledger close time (unix seconds) at that read: the smoothing time anchor. */
  anchorLedgerSeconds: bigint;
  /** Date.now() when the anchor landed. */
  anchorMs: number;
  /** Smooth upward only while the stream is still accruing. */
  ticking: boolean;
}

export function TickingBalance({
  stream,
  chainAccrued,
  anchorLedgerSeconds,
  anchorMs,
  ticking,
}: TickingBalanceProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (node === null) {
      return;
    }

    const paint = (): void => {
      const value = ticking
        ? smoothedAccrued(
            stream,
            anchorLedgerSeconds,
            BigInt(Math.max(0, Date.now() - anchorMs)),
          )
        : chainAccrued;
      node.textContent = stroopsToXlm(value, { fractionDigits: 7 });
    };

    // Paint once synchronously so there is never an empty flash, then, only for
    // an active stream, drive the smooth tick. A static stream paints once and
    // holds (no rAF loop running needlessly on a completed/cancelled screen).
    paint();
    if (!ticking) {
      return;
    }
    let frame = requestAnimationFrame(function loop() {
      paint();
      frame = requestAnimationFrame(loop);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [stream, chainAccrued, anchorLedgerSeconds, anchorMs, ticking]);

  return (
    <span
      ref={ref}
      aria-live="off"
      className="block break-all text-5xl font-semibold tracking-tight text-slate-900 tabular-nums sm:text-6xl"
    />
  );
}
