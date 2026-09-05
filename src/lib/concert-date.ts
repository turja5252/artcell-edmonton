import { parseIsoDate } from "@/lib/deliverables";

export const CONCERT_TIMEZONE = "America/Edmonton";
export const DEFAULT_CONCERT_DATE = "2026-09-20";

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Calendar day in a named timezone — not the machine's UTC date. */
export function zonedIsoDate(now = new Date(), timeZone = CONCERT_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return DEFAULT_CONCERT_DATE;
  return `${year}-${month}-${day}`;
}

export function normalizeConcertDate(value: string | null | undefined): string {
  return parseIsoDate(value) ?? DEFAULT_CONCERT_DATE;
}

function utcNoon(isoDate: string): number {
  const match = ISO_DAY.exec(isoDate);
  if (!match) return 0;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Whole calendar days from today in `timeZone` to the concert date. */
export function daysUntilConcert(
  concertDate: string,
  now = new Date(),
  timeZone = CONCERT_TIMEZONE
): number {
  const concert = normalizeConcertDate(concertDate);
  const today = zonedIsoDate(now, timeZone);
  return Math.round((utcNoon(concert) - utcNoon(today)) / 86_400_000);
}

export function formatConcertShort(concertDate: string): string {
  const parsed = normalizeConcertDate(concertDate);
  const [year, month, day] = parsed.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(year, month - 1, day));
}

export function concertCountdownCopy(
  concertDate: string,
  now = new Date(),
  timeZone = CONCERT_TIMEZONE
): { headline: string; subtitle: string; days: number } {
  const date = normalizeConcertDate(concertDate);
  const days = daysUntilConcert(date, now, timeZone);
  const short = formatConcertShort(date);
  if (days > 1) return { headline: `${days} days left`, subtitle: short, days };
  if (days === 1) return { headline: "Concert tomorrow", subtitle: short, days };
  if (days === 0) return { headline: "Concert today", subtitle: short, days };
  return { headline: `Show was ${short}`, subtitle: short, days };
}
