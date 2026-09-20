"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clock3, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  MC_CHAPTERS,
  SPONSOR_SPEECHES,
  SPONSORS,
  THANKS,
  chapterAtMinute,
  cueMatchesSpeaker,
  formatEdmontonClock,
  minutesInZone,
  speakerLabel,
  type McChapter,
  type McSpeaker,
} from "@/lib/show-mc";
import { cn } from "@/lib/utils";

const DONE_KEY = "artcell-edmonton-mc-done";

type SpeakerFilter = "all" | McSpeaker;

function readDone(): string[] {
  try {
    const raw = window.localStorage.getItem(DONE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeDone(ids: string[]) {
  window.localStorage.setItem(DONE_KEY, JSON.stringify(ids));
}

export function ShowMcBoard({ me }: { me: string }) {
  const [now, setNow] = useState(() => new Date());
  const [filter, setFilter] = useState<SpeakerFilter>("all");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setDone(readDone());
    setHydrated(true);
    const tick = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(tick);
  }, []);

  const minute = minutesInZone(now);
  const live = chapterAtMinute(minute);
  const clock = formatEdmontonClock(now);
  const iAmTn = /tanzim/i.test(me);

  const chapters = useMemo(() => {
    return MC_CHAPTERS.map((chapter) => ({
      ...chapter,
      cues: chapter.cues.filter((cue) => cueMatchesSpeaker(cue, filter)),
    })).filter((chapter) => chapter.cues.length > 0);
  }, [filter]);

  const visible = focusId ? chapters.filter((chapter) => chapter.id === focusId) : chapters;
  const doneCount = MC_CHAPTERS.flatMap((chapter) => chapter.cues).filter((cue) =>
    done.includes(cue.id)
  ).length;
  const totalCues = MC_CHAPTERS.reduce((sum, chapter) => sum + chapter.cues.length, 0);

  function toggle(id: string) {
    setDone((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      writeDone(next);
      return next;
    });
  }

  function resetTicks() {
    writeDone([]);
    setDone([]);
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
        <p className="text-[11px] tracking-wide text-primary uppercase">Show MC · Edmonton time</p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <p className="font-heading text-3xl leading-none tabular-nums text-primary">{clock}</p>
          <p className="text-sm font-medium text-primary">
            On now · Ch {live.number} {live.title}
          </p>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          <span className="font-semibold text-sky-300">Blue is TN</span>
          {iAmTn ? " (you)" : " · Tanzim"}
          . <span className="font-semibold text-pink-300">Pink is RS</span>
          . Together cues stay neutral.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            className="h-10 rounded-full"
            onClick={() => {
              setFocusId(live.id);
              window.setTimeout(() => {
                document.getElementById(`mc-${live.id}`)?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }, 50);
            }}
          >
            <Clock3 className="size-4" />
            Jump to now
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-full"
            onClick={() => setFocusId(null)}
          >
            Whole night
          </Button>
        </div>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {MC_CHAPTERS.map((chapter) => {
          const on = chapter.id === live.id;
          const focused = focusId === chapter.id;
          return (
            <Button
              key={chapter.id}
              type="button"
              variant={focused || (!focusId && on) ? "default" : "outline"}
              className="h-10 shrink-0 rounded-full px-3"
              onClick={() => {
                setFocusId((current) => (current === chapter.id ? null : chapter.id));
                window.setTimeout(() => {
                  document.getElementById(`mc-${chapter.id}`)?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }, 50);
              }}
            >
              {chapter.clock.replace(" PM", "")} {chapter.title}
              {on ? <span className="tabular-nums opacity-80">Now</span> : null}
            </Button>
          );
        })}
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {(
          [
            { id: "all", label: "All cues" },
            { id: "TN", label: "TN lines" },
            { id: "RS", label: "RS lines" },
            { id: "BOTH", label: "Together" },
          ] as { id: SpeakerFilter; label: string }[]
        ).map((item) => (
          <Button
            key={item.id}
            type="button"
            variant={filter === item.id ? "default" : "outline"}
            className={cn("h-10 shrink-0 rounded-full px-3", filterChip(item.id, filter === item.id))}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center">
          <p className="font-medium">No cues on this filter</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Switch to All cues, or open Whole night.
          </p>
        </div>
      ) : (
        visible.map((chapter) => (
          <ChapterCard
            key={chapter.id}
            chapter={chapter}
            live={chapter.id === live.id}
            done={done}
            showTicks={hydrated}
            onToggle={toggle}
          />
        ))
      )}

      <SponsorCard />

      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <p>
          {hydrated ? `${doneCount}/${totalCues} cues ticked` : "Ticks stay on this phone"}
        </p>
        <Button type="button" variant="ghost" className="h-10" onClick={resetTicks}>
          <RotateCcw className="size-4" />
          Reset ticks
        </Button>
      </div>
    </div>
  );
}

function ChapterCard({
  chapter,
  live,
  done,
  showTicks,
  onToggle,
}: {
  chapter: McChapter;
  live: boolean;
  done: string[];
  showTicks: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <section
      id={`mc-${chapter.id}`}
      className={cn(
        "scroll-mt-4 rounded-2xl border bg-card/80 p-4",
        live ? "border-primary/50" : "border-border/80"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-wide text-primary uppercase">
            Chapter {chapter.number} · {chapter.clock}
          </p>
          <h2 className="font-heading mt-1 text-2xl leading-none">{chapter.title}</h2>
        </div>
        {live ? (
          <span className="shrink-0 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
            On now
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{chapter.summary}</p>

      <ul className="mt-4 space-y-3">
        {chapter.cues.map((cue) => {
          const ticked = showTicks && done.includes(cue.id);
          return (
            <li key={cue.id}>
              <article
                className={cn(
                  "rounded-2xl border p-3",
                  ticked ? "border-border/60 bg-background/40 opacity-70" : speakerFrame(cue.speaker)
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className={speakerPill(cue.speaker)}>{speakerLabel(cue.speaker)}</span>
                    <h3 className="mt-2 text-base font-semibold leading-tight">{cue.title}</h3>
                  </div>
                  <Button
                    type="button"
                    variant={ticked ? "outline" : "secondary"}
                    className="h-11 shrink-0 px-3"
                    onClick={() => onToggle(cue.id)}
                  >
                    <Check className="size-4" />
                    {ticked ? "Undo" : "Done"}
                  </Button>
                </div>
                {cue.scriptBn ? (
                  <p
                    className={cn(
                      "font-bengali mt-3 text-lg leading-relaxed whitespace-pre-wrap",
                      speakerText(cue.speaker)
                    )}
                  >
                    {cue.scriptBn}
                  </p>
                ) : null}
                <p className={cn("mt-3 text-base leading-relaxed", speakerText(cue.speaker))}>
                  {cue.script}
                </p>
                {cue.note ? (
                  <p className="mt-2 text-xs text-muted-foreground">{cue.note}</p>
                ) : null}
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SponsorCard() {
  return (
    <section className="rounded-2xl border border-border/80 bg-card/80 p-4">
      <p className="text-[11px] tracking-wide text-primary uppercase">Glance list</p>
      <h2 className="font-heading mt-1 text-2xl leading-none">Sponsors and thanks</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Use this if you lose the thread. Speeches first, then the full board, then the close list.
      </p>

      <h3 className="mt-4 text-sm font-semibold">Who speaks</h3>
      <ul className="mt-2 space-y-2">
        {SPONSOR_SPEECHES.map((row) => (
          <li key={row.company} className="rounded-xl bg-background/50 px-3 py-2 text-sm">
            <span className="font-medium">{row.company}</span>
            <span className="mt-0.5 block text-muted-foreground">{row.speakers}</span>
          </li>
        ))}
      </ul>

      <h3 className="mt-4 text-sm font-semibold">Full board</h3>
      <ul className="mt-2 divide-y divide-border/60">
        {SPONSORS.map((row) => (
          <li key={`${row.tier}-${row.name}`} className="flex items-start justify-between gap-3 py-2 text-sm">
            <span>{row.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {row.tier}
              {row.note ? ` · ${row.note}` : ""}
            </span>
          </li>
        ))}
      </ul>

      <h3 className="mt-4 text-sm font-semibold">10:15 names</h3>
      <p className="mt-2 text-sm leading-relaxed">
        Sound: {THANKS.sound}. Dhaka Archive: {THANKS.dhakaArchive.join(", ")}. BCCB: {THANKS.bccb}.
        Photo: {THANKS.photo}. {THANKS.digital}. Volunteers: {THANKS.volunteers.join(", ")}.
        Then everyone on stage for the family photo.
      </p>
    </section>
  );
}

function speakerFrame(speaker: McSpeaker): string {
  if (speaker === "TN") return "border-sky-400/70 bg-sky-500/15";
  if (speaker === "RS") return "border-pink-400/70 bg-pink-500/15";
  return "border-border/80 bg-background/40";
}

function speakerText(speaker: McSpeaker): string {
  if (speaker === "TN") return "text-sky-100";
  if (speaker === "RS") return "text-pink-100";
  return "text-foreground";
}

function speakerPill(speaker: McSpeaker): string {
  if (speaker === "TN") {
    return "inline-flex rounded-full bg-sky-400 px-2.5 py-0.5 text-xs font-semibold text-zinc-950";
  }
  if (speaker === "RS") {
    return "inline-flex rounded-full bg-pink-400 px-2.5 py-0.5 text-xs font-semibold text-zinc-950";
  }
  return "inline-flex rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold";
}

function filterChip(id: SpeakerFilter, active: boolean): string {
  if (!active) {
    if (id === "TN") return "border-sky-400/50 text-sky-200";
    if (id === "RS") return "border-pink-400/50 text-pink-200";
    return "";
  }
  if (id === "TN") return "border-sky-400 bg-sky-400 text-zinc-950 hover:bg-sky-300";
  if (id === "RS") return "border-pink-400 bg-pink-400 text-zinc-950 hover:bg-pink-300";
  return "";
}
