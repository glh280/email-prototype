"use client";

/**
 * SOURCE: new (no PROD source — Workspace shell resizable body)
 * CREATED: 2026-04-27
 * STATUS: new
 * REINTEGRATION: Phase 2+ persists widths to user prefs (cookie or DB).
 *
 * 3-pane resizable container with draggable dividers + viewport
 * auto-adjust. Pane widths kept in local state (no persistence yet).
 * Right pane is always `flex-1` and absorbs remaining space.
 *
 * Constraints (px):
 *   left   200..320
 *   center 380..520  (raised from 280..520 — narrow center hid subjects)
 *   right  >= 420 (no max — soaks up remainder, default-largest)
 *
 * If viewport shrinks below the sum of current widths + right-min,
 * left/center are scaled down so right keeps its minimum. If viewport
 * is too small even for all minimums (left 200 + center 380 + right
 * 420 + 2 dividers = 1008 px), the container will horizontal-overflow
 * its parent — Phase 1 explicitly excludes <1024 px viewports.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

const LEFT_MIN = 200;
const LEFT_MAX = 320;
const CENTER_MIN = 380;
const CENTER_MAX = 520;
const RIGHT_MIN = 420;
const DIVIDER_WIDTH = 4;
const DEFAULT_LEFT = 240;
const DEFAULT_CENTER = 420;

type DragTarget = "left" | "center" | null;

type Props = {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function Inbox2ResizableBody({ left, center, right }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<DragTarget>(null);
  const [leftW, setLeftW] = useState(DEFAULT_LEFT);
  const [centerW, setCenterW] = useState(DEFAULT_CENTER);
  const [containerW, setContainerW] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setContainerW(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (containerW === null) return;
    const availableForLeftCenter =
      containerW - 2 * DIVIDER_WIDTH - RIGHT_MIN;
    if (availableForLeftCenter <= 0) return;
    if (leftW + centerW <= availableForLeftCenter) return;

    const newLeft = clamp(
      Math.min(leftW, availableForLeftCenter - CENTER_MIN),
      LEFT_MIN,
      LEFT_MAX,
    );
    const newCenter = clamp(
      availableForLeftCenter - newLeft,
      CENTER_MIN,
      CENTER_MAX,
    );
    if (newLeft !== leftW) setLeftW(newLeft);
    if (newCenter !== centerW) setCenterW(newCenter);
  }, [containerW, leftW, centerW]);

  const onPointerDown = useCallback(
    (target: Exclude<DragTarget, null>) =>
      (e: ReactPointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        draggingRef.current = target;
        e.currentTarget.setPointerCapture(e.pointerId);
      },
    [],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = draggingRef.current;
      const container = containerRef.current;
      if (!drag || !container) return;
      const rect = container.getBoundingClientRect();
      const totalW = containerW ?? rect.width;
      const x = e.clientX - rect.left;

      if (drag === "left") {
        const upperByRight =
          totalW - 2 * DIVIDER_WIDTH - centerW - RIGHT_MIN;
        const next = clamp(x, LEFT_MIN, Math.min(LEFT_MAX, upperByRight));
        if (next !== leftW) setLeftW(next);
      } else {
        const desired = x - leftW - DIVIDER_WIDTH;
        const upperByRight =
          totalW - leftW - 2 * DIVIDER_WIDTH - RIGHT_MIN;
        const next = clamp(
          desired,
          CENTER_MIN,
          Math.min(CENTER_MAX, upperByRight),
        );
        if (next !== centerW) setCenterW(next);
      }
    },
    [centerW, leftW, containerW],
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingRef.current === null) return;
      draggingRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer was already released by the browser; safe to ignore.
      }
    },
    [],
  );

  const isDragging = draggingRef.current !== null;

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex-1 flex min-h-0",
        isDragging && "select-none cursor-col-resize",
      )}
    >
      <div
        style={{ width: leftW }}
        className="shrink-0 min-h-0 overflow-hidden"
      >
        {left}
      </div>
      <ResizeHandle
        onPointerDown={onPointerDown("left")}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        ariaLabel="Resize navigation rail"
      />
      <div
        style={{ width: centerW }}
        className="shrink-0 min-h-0 overflow-hidden flex flex-col"
      >
        {center}
      </div>
      <ResizeHandle
        onPointerDown={onPointerDown("center")}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        ariaLabel="Resize message list"
      />
      <div className="flex-1 min-w-0 min-h-0 overflow-hidden">{right}</div>
    </div>
  );
}

type HandleProps = {
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => void;
  ariaLabel: string;
};

function ResizeHandle({
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  ariaLabel,
}: HandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      className={cn(
        "relative w-1 shrink-0 bg-border cursor-col-resize",
        "hover:bg-primary/40 active:bg-primary/60 transition-colors",
        "after:absolute after:inset-y-0 after:-left-1 after:-right-1 after:content-['']",
      )}
    />
  );
}
