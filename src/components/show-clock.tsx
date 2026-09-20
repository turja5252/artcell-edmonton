"use client";

import { useEffect, useState } from "react";

import { DEFAULT_CONCERT_DATE } from "@/lib/concert-date";
import { showClockState } from "@/lib/show-mc";
import { cn } from "@/lib/utils";

export function useShowNow() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, []);

  return now;
}

export function ShowClock({
  concertDate = DEFAULT_CONCERT_DATE,
  onOpenMc,
  compact = false,
}: {
  concertDate?: string;
  onOpenMc?: () => void;
  compact?: boolean;
}) {
  const now = useShowNow();
  const state = showClockState(now ?? new Date(0), concertDate);
  const ready = Boolean(now);

  const body = (
    <>
      <div className="min-w-0">
        <p className="text-[11px] tracking-wide text-primary uppercase">Edmonton clock</p>
        <p
          className={cn(
            "font-heading leading-none tabular-nums text-primary",
            compact ? "mt-1 text-2xl" : "mt-1 text-3xl"
          )}
        >
          {ready ? state.clock : "--:--:--"}
        </p>
      </div>
      <div className="min-w-0 text-right">
        <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
          {state.phase === "live" ? "Time left" : state.phase === "after" ? "Timer" : "Opens in"}
        </p>
        <p
          className={cn(
            "font-heading leading-none tabular-nums",
            compact ? "mt-1 text-2xl" : "mt-1 text-3xl"
          )}
        >
          {ready ? state.headline : "--:--"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{ready ? state.detail : "Syncing Edmonton time"}</p>
      </div>
    </>
  );

  const progress =
    state.progress == null ? null : (
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${Math.round(state.progress * 100)}%` }}
        />
      </div>
    );

  if (onOpenMc) {
    return (
      <button
        type="button"
        onClick={onOpenMc}
        className="w-full rounded-2xl border border-primary/30 bg-primary/10 p-3 text-left"
      >
        <div className="flex items-end justify-between gap-3">{body}</div>
        {progress}
        <p className="mt-2 text-xs font-medium text-primary">Open Show MC</p>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/10 p-3">
      <div className="flex items-end justify-between gap-3">{body}</div>
      {progress}
    </div>
  );
}
