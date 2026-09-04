"use client";

import { ExternalLink, Play } from "lucide-react";

import { SETLIST } from "@/lib/setlist";

export function SetlistBoard() {
  return (
    <div className="space-y-3 pb-24">
      <p className="text-sm text-muted-foreground">
        Tap a cue to open the YouTube clip at that timestamp. Use this on the floor
        when someone asks “what’s next?”
      </p>
      <ol className="space-y-2">
        {SETLIST.map((cue, index) => (
          <li key={cue.id}>
            <a
              href={cue.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card/80 p-3 shadow-sm backdrop-blur-sm transition active:scale-[0.99]"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 font-heading text-lg text-primary">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium leading-tight">{cue.label}</span>
                <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Play className="size-3" />
                  Jump to {cue.timestamp}
                </span>
              </span>
              <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
