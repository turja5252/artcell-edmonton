import type { Deliverable } from "@/lib/types";

/** Amber badge — not the red declined-sponsor glow. */
export const OVERDUE_PILL_CLASS =
  "inline-flex items-center gap-1 rounded-md bg-amber-500 px-2 py-0.5 text-xs font-semibold tracking-wide text-zinc-950 uppercase";

export const DUE_TODAY_PILL_CLASS =
  "inline-flex items-center rounded-md border border-primary/70 bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary";

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDate(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const day = raw.length >= 10 ? raw.slice(0, 10) : raw;
  const match = ISO_DAY.exec(day);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const check = new Date(year, month - 1, date);
  if (
    check.getFullYear() !== year ||
    check.getMonth() !== month - 1 ||
    check.getDate() !== date
  ) {
    return null;
  }
  return day;
}

export function todayIsoDate(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addIsoDays(isoDate: string, days: number): string {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) return isoDate;
  const [year, month, date] = parsed.split("-").map(Number);
  const next = new Date(year, month - 1, date + days);
  return todayIsoDate(next);
}

export function isDeliverableOverdue(
  item: Pick<Deliverable, "dueDate" | "done">,
  today = todayIsoDate()
): boolean {
  if (item.done) return false;
  const due = parseIsoDate(item.dueDate);
  return Boolean(due && due < today);
}

export function formatDueDate(iso: string): string {
  const parsed = parseIsoDate(iso);
  if (!parsed) return iso;
  const [year, month, date] = parsed.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(year, month - 1, date));
}

export type DueGroupId = "overdue" | "today" | "tomorrow" | "week" | "later" | "done";

export const DUE_GROUP_LABEL: Record<DueGroupId, string> = {
  overdue: "Overdue",
  today: "Due today",
  tomorrow: "Tomorrow",
  week: "This week",
  later: "Later",
  done: "Completed",
};

export function dueGroupId(
  item: Pick<Deliverable, "dueDate" | "done">,
  today = todayIsoDate()
): DueGroupId {
  if (item.done) return "done";
  const due = parseIsoDate(item.dueDate) ?? item.dueDate;
  if (due < today) return "overdue";
  if (due === today) return "today";
  if (due === addIsoDays(today, 1)) return "tomorrow";
  if (due <= addIsoDays(today, 6)) return "week";
  return "later";
}

export function compareDeliverables(a: Deliverable, b: Deliverable): number {
  const aDone = Number(a.done);
  const bDone = Number(b.done);
  if (aDone !== bDone) return aDone - bDone;
  const due = a.dueDate.localeCompare(b.dueDate);
  if (due !== 0) return due;
  return a.title.localeCompare(b.title);
}
