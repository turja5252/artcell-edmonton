"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clock3, Pencil, RotateCcw } from "lucide-react";

import { McSortableCues } from "@/components/mc-sortable-cues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useShowNow } from "@/components/show-clock";
import { formatTime } from "@/lib/people";
import {
  applyMcOverrides,
  chapterAtMinute,
  chapterOrderIsCustom,
  cueMatchesSpeaker,
  EMPTY_MC_PROMPTS,
  findStockCue,
  isMcCueOverridden,
  MC_CHAPTERS,
  minutesInZone,
  showClockState,
  speakerLabel,
  SPONSOR_SPEECHES,
  type McChapter,
  type McCue,
  type McSpeaker,
} from "@/lib/show-mc";
import type { McPromptPatch, McPromptStore } from "@/lib/types";
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

export function ShowMcBoard({
  me,
  concertDate,
  prompts = EMPTY_MC_PROMPTS,
  onSavePrompt,
}: {
  me: string;
  concertDate?: string;
  prompts?: McPromptStore;
  onSavePrompt: (input: McPromptPatch) => Promise<void>;
}) {
  const now = useShowNow();
  const [filter, setFilter] = useState<SpeakerFilter>("all");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [editing, setEditing] = useState<McCue | null>(null);

  useEffect(() => {
    setDone(readDone());
    setHydrated(true);
  }, []);

  const liveNow = now ?? new Date(0);
  const minute = minutesInZone(liveNow);
  const live = chapterAtMinute(minute);
  const timer = showClockState(liveNow, concertDate);
  const iAmTn = /tanzim/i.test(me);
  const iAmRs = /rowshon/i.test(me);
  const editedCount = Object.keys(prompts.cues).length;

  const applied = useMemo(() => applyMcOverrides(MC_CHAPTERS, prompts), [prompts]);
  const canReorder = filter === "all";

  const chapters = useMemo(() => {
    return applied
      .map((chapter) => ({
        ...chapter,
        cues: chapter.cues.filter((cue) => cueMatchesSpeaker(cue, filter)),
      }))
      .filter((chapter) => chapter.cues.length > 0);
  }, [applied, filter]);

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
        <p className="text-[11px] tracking-wide text-primary uppercase">Show MC</p>
        <p className="font-heading mt-1 text-2xl leading-none">
          Ch {live.number} {live.title}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {timer.phase === "live"
            ? `${timer.headline} left in this block`
            : timer.phase === "after"
              ? "Night is closed"
              : `${timer.headline} until this chapter`}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          <span className="font-semibold text-sky-300">Blue is TN · Tanzim</span>
          {iAmTn ? " (you)" : ""}
          . <span className="font-semibold text-pink-300">Pink is RS · Rowshon</span>
          {iAmRs ? " (you)" : ""}
          . One full sponsor each. Same for the vote of thanks.
        </p>
        <p className="mt-2 text-sm text-foreground">
          Slide the grip to change order. Tap TN, Rowshon, or Both to switch who speaks. Edit saves
          the wording. All of that is shared
          {editedCount ? ` · ${editedCount} line${editedCount === 1 ? "" : "s"} changed` : ""}.
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
            { id: "RS", label: "Rowshon" },
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
            prompts={prompts}
            canReorder={canReorder}
            onToggle={toggle}
            onEdit={setEditing}
            onSpeaker={(id, speaker) => {
              void onSavePrompt({ id, speaker });
            }}
            onReorder={(order) => {
              void onSavePrompt({ chapterId: chapter.id, order });
            }}
            onResetOrder={() => {
              void onSavePrompt({ chapterId: chapter.id, resetOrder: true });
            }}
          />
        ))
      )}

      <SponsorCard chapters={applied} />

      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <p>
          {hydrated ? `${doneCount}/${totalCues} cues ticked` : "Ticks stay on this phone"}
        </p>
        <Button type="button" variant="ghost" className="h-10" onClick={resetTicks}>
          <RotateCcw className="size-4" />
          Reset ticks
        </Button>
      </div>

      <McPromptEditor
        cue={editing}
        prompts={prompts}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onSave={onSavePrompt}
      />
    </div>
  );
}

function ChapterCard({
  chapter,
  live,
  done,
  showTicks,
  prompts,
  canReorder,
  onToggle,
  onEdit,
  onSpeaker,
  onReorder,
  onResetOrder,
}: {
  chapter: McChapter;
  live: boolean;
  done: string[];
  showTicks: boolean;
  prompts: McPromptStore;
  canReorder: boolean;
  onToggle: (id: string) => void;
  onEdit: (cue: McCue) => void;
  onSpeaker: (id: string, speaker: McSpeaker) => void;
  onReorder: (order: string[]) => void;
  onResetOrder: () => void;
}) {
  const customOrder = chapterOrderIsCustom(chapter.id, prompts);
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
      {!canReorder ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Switch to All cues to slide the order.
        </p>
      ) : customOrder ? (
        <Button type="button" variant="ghost" className="mt-1 h-9 px-2" onClick={onResetOrder}>
          <RotateCcw className="size-4" />
          Reset this chapter’s order
        </Button>
      ) : null}

      <McSortableCues
        items={chapter.cues}
        disabled={!canReorder}
        onReorder={onReorder}
        render={(cue, handle) => {
          const ticked = showTicks && done.includes(cue.id);
          const edited = isMcCueOverridden(cue.id, prompts);
          const override = prompts.cues[cue.id];
          return (
              <article
                className={cn(
                  "flex gap-2 rounded-2xl border p-3",
                  ticked ? "border-border/60 bg-background/40 opacity-70" : speakerFrame(cue.speaker)
                )}
              >
                {handle}
                <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {edited ? (
                      <span className="mb-2 inline-flex rounded-full bg-amber-400 px-2 py-0.5 text-xs font-semibold text-zinc-950">
                        Edited
                      </span>
                    ) : null}
                    <h3 className="text-base font-semibold leading-tight">{cue.title}</h3>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 px-3"
                      onClick={() => onEdit(cue)}
                    >
                      <Pencil className="size-4" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant={ticked ? "outline" : "secondary"}
                      className="h-11 px-3"
                      onClick={() => onToggle(cue.id)}
                    >
                      <Check className="size-4" />
                      {ticked ? "Undo" : "Done"}
                    </Button>
                  </div>
                </div>
                <SpeakerPick
                  value={cue.speaker}
                  className="mt-2"
                  onChange={(speaker) => onSpeaker(cue.id, speaker)}
                />
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
                {cue.lines?.length ? (
                  <ul className="mt-3 space-y-2">
                    {cue.lines.map((line, index) => (
                      <li
                        key={`${cue.id}-${line.speaker}-${index}`}
                        className={cn("rounded-xl px-3 py-2", speakerFrame(line.speaker))}
                      >
                        <span className={speakerPill(line.speaker)}>{speakerLabel(line.speaker)}</span>
                        <p
                          className={cn(
                            "mt-1 leading-snug",
                            line.speaker === "RS"
                              ? "text-xl font-semibold text-pink-50"
                              : "text-base text-sky-100"
                          )}
                        >
                          {line.text}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : cue.script ? (
                  <p className={cn("mt-3 text-base leading-relaxed", speakerText(cue.speaker))}>
                    {cue.script}
                  </p>
                ) : null}
                {cue.note ? (
                  <p className="mt-2 text-xs text-muted-foreground">{cue.note}</p>
                ) : null}
                {edited && override?.updatedAt ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Edited {formatTime(override.updatedAt)}
                    {override.updatedBy ? ` · ${override.updatedBy}` : ""}
                  </p>
                ) : null}
                </div>
              </article>
          );
        }}
      />
    </section>
  );
}

function McPromptEditor({
  cue,
  prompts,
  onOpenChange,
  onSave,
}: {
  cue: McCue | null;
  prompts: McPromptStore;
  onOpenChange: (open: boolean) => void;
  onSave: (input: McPromptPatch) => Promise<void>;
}) {
  const stock = cue ? findStockCue(cue.id) : null;
  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [scriptBn, setScriptBn] = useState("");
  const [note, setNote] = useState("");
  const [speaker, setSpeaker] = useState<McSpeaker>("BOTH");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!cue) return;
    setTitle(cue.title);
    setScript(cue.script);
    setScriptBn(cue.scriptBn ?? "");
    setNote(cue.note ?? "");
    setSpeaker(cue.speaker);
    setFormError("");
  }, [cue]);

  const edited = cue ? isMcCueOverridden(cue.id, prompts) : false;

  async function submit(reset = false) {
    if (!cue) return;
    setBusy(true);
    setFormError("");
    try {
      await onSave(
        reset
          ? { id: cue.id, reset: true }
          : { id: cue.id, title, script, scriptBn, note, speaker }
      );
      onOpenChange(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save prompt");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={Boolean(cue)} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92dvh] gap-0 overflow-y-auto rounded-t-3xl sm:max-w-none"
      >
        <SheetHeader className="pb-2">
          <SheetTitle className="font-heading text-2xl tracking-wide">
            Edit this line
          </SheetTitle>
          <SheetDescription>
            {cue ? `${speakerLabel(cue.speaker)} · ${cue.title}` : "Change the spoken line."}{" "}
            Saves for both phones. Reset puts the original back.
          </SheetDescription>
        </SheetHeader>
        <form
          className="space-y-3 px-4 pb-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(false);
          }}
        >
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Who says it
            </p>
            <SpeakerPick value={speaker} className="mt-1" onChange={setSpeaker} />
          </div>
          <label className="block text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Title
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-1 h-12 text-base"
            />
          </label>
          <label className="block text-xs font-medium tracking-wide text-muted-foreground uppercase">
            What to say
            <Textarea
              value={script}
              onChange={(event) => setScript(event.target.value)}
              className="mt-1 min-h-36 text-base leading-relaxed"
            />
          </label>
          <label className="block text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Bangla
            <Textarea
              value={scriptBn}
              onChange={(event) => setScriptBn(event.target.value)}
              className="font-bengali mt-1 min-h-28 text-lg leading-relaxed"
              placeholder="Optional — Dhaka Archive and any other Bangla line"
            />
          </label>
          <label className="block text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Side note
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="mt-1 min-h-20 text-base"
              placeholder="Hold, point, or who walks up"
            />
          </label>
          {stock && edited ? (
            <p className="text-xs text-muted-foreground">
              Original starts: {stock.script.slice(0, 90)}
              {stock.script.length > 90 ? "…" : ""}
            </p>
          ) : null}
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          <SheetFooter className="px-0">
            {edited ? (
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full"
                disabled={busy}
                onClick={() => void submit(true)}
              >
                <RotateCcw className="size-4" />
                {busy ? "Saving…" : "Reset to original"}
              </Button>
            ) : null}
            <Button type="submit" className="h-12 w-full" disabled={busy}>
              {busy ? "Saving…" : "Save for both phones"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function SponsorCard({ chapters }: { chapters: McChapter[] }) {
  const sponsorCues =
    chapters
      .find((chapter) => chapter.id === "sponsors")
      ?.cues.filter(
        (cue) =>
          cue.id.startsWith("sponsors-") &&
          cue.id !== "sponsors-open" &&
          cue.id !== "sponsors-recall"
      ) ?? [];
  const thanks =
    chapters
      .find((chapter) => chapter.id === "close")
      ?.cues.filter((cue) => cue.id.startsWith("close-") && cue.id !== "close-open" && cue.id !== "close-photo") ??
    [];

  return (
    <section className="rounded-2xl border border-border/80 bg-card/80 p-4">
      <p className="text-[11px] tracking-wide text-primary uppercase">Glance list</p>
      <h2 className="font-heading mt-1 text-2xl leading-none">Sponsors and thanks</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        One full line each. Blue is TN · Tanzim. Pink is RS · Rowshon. Edits on the cues above show up here too.
      </p>

      <h3 className="mt-4 text-sm font-semibold">Who walks up</h3>
      <ul className="mt-2 space-y-2">
        {SPONSOR_SPEECHES.map((row) => (
          <li key={row.company} className="rounded-xl bg-background/50 px-3 py-2 text-sm">
            <span className="font-medium">{row.company}</span>
            <span className="mt-0.5 block text-muted-foreground">{row.speakers}</span>
          </li>
        ))}
      </ul>

      <h3 className="mt-4 text-sm font-semibold">Tandem board</h3>
      <ul className="mt-2 space-y-2">
        {sponsorCues.map((cue) => (
          <li key={cue.id} className={cn("rounded-xl px-3 py-2", speakerFrame(cue.speaker))}>
            <span className={speakerPill(cue.speaker)}>{speakerLabel(cue.speaker)}</span>
            <p className={cn("mt-1 text-base font-semibold leading-snug", speakerText(cue.speaker))}>
              {cue.script}
            </p>
          </li>
        ))}
      </ul>

      <h3 className="mt-4 text-sm font-semibold">10:15 thanks</h3>
      <ul className="mt-2 space-y-2">
        {thanks.map((cue) => (
          <li key={cue.id} className={cn("rounded-xl px-3 py-2", speakerFrame(cue.speaker))}>
            <span className={speakerPill(cue.speaker)}>{speakerLabel(cue.speaker)}</span>
            <p className={cn("mt-1 text-base font-semibold leading-snug", speakerText(cue.speaker))}>
              {cue.script}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-muted-foreground">
        Then everyone on stage for the family photo.
      </p>
    </section>
  );
}

function SpeakerPick({
  value,
  onChange,
  className,
}: {
  value: McSpeaker;
  onChange: (speaker: McSpeaker) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {(
        [
          { id: "TN", label: "TN" },
          { id: "RS", label: "Rowshon" },
          { id: "BOTH", label: "Both" },
        ] as { id: McSpeaker; label: string }[]
      ).map((item) => {
        const active = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              if (!active) onChange(item.id);
            }}
            className={cn(
              "h-9 rounded-full px-3 text-xs font-semibold",
              active
                ? item.id === "TN"
                  ? "bg-sky-400 text-zinc-950"
                  : item.id === "RS"
                    ? "bg-pink-400 text-zinc-950"
                    : "bg-secondary text-foreground"
                : item.id === "TN"
                  ? "border border-sky-400/50 text-sky-200"
                  : item.id === "RS"
                    ? "border border-pink-400/50 text-pink-200"
                    : "border border-border text-muted-foreground"
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
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
