export type Member = {
  id: string;
  name: string;
  phone: string;
  email: string;
};

export type MemberPatch = Partial<Pick<Member, "name" | "phone" | "email">> & {
  actor?: string | null;
};

export type LeadAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string | null;
};

export type Lead = {
  id: string;
  company: string;
  assignedTo: string | null;
  done: boolean;
  declined: boolean;
  /** Explicit “work started” toggle. Outcome waiting language also counts. */
  inProgress: boolean;
  outcome: string;
  committed: number;
  received: number;
  receivedBy: string | null;
  attachments: LeadAttachment[];
  updatedAt: string | null;
  updatedBy: string | null;
};

export type LeadPatch = Partial<
  Pick<
    Lead,
    | "assignedTo"
    | "done"
    | "declined"
    | "inProgress"
    | "outcome"
    | "company"
    | "committed"
    | "received"
    | "receivedBy"
  >
> & {
  actor?: string | null;
};

export type GuestStatus =
  | "not_called"
  | "confirmed"
  | "tentative"
  | "declined"
  // legacy values kept for older saved data
  | "not_reached"
  | "reached"
  | "reminded"
  | "maybe";

export type ContactVia = "call" | "text";

export type ContactEvent = {
  at: string;
  via: ContactVia;
  by: string | null;
};

export type Guest = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  phone: string;
  email: string;
  assignedTo: string | null;
  status: GuestStatus;
  partySize: number;
  ticketBought: boolean;
  lastContactedAt: string | null;
  lastContactedVia: ContactVia | null;
  lastCalledAt: string | null;
  lastCalledBy: string | null;
  lastTextedAt: string | null;
  lastTextedBy: string | null;
  contactLog: ContactEvent[];
  notes: string;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type GuestPatch = Partial<
  Pick<
    Guest,
    | "firstName"
    | "lastName"
    | "name"
    | "phone"
    | "email"
    | "assignedTo"
    | "status"
    | "partySize"
    | "ticketBought"
    | "lastContactedAt"
    | "lastContactedVia"
    | "lastCalledAt"
    | "lastCalledBy"
    | "lastTextedAt"
    | "lastTextedBy"
    | "contactLog"
    | "notes"
  >
> & {
  actor?: string | null;
  contactVia?: ContactVia | null;
};

export type Settings = {
  moneyTarget: number;
  attendanceTarget: number;
  ticketsSold: number;
  ticketsSoldUpdatedAt: string | null;
  ticketsSoldUpdatedBy: string | null;
  /** Official MacEwan checkout. Tracking query strings are stripped on read/write. */
  ticketUrl: string;
  /** ISO calendar day of the show, e.g. 2026-09-20. */
  concertDate: string;
};

export type Deliverable = {
  id: string;
  title: string;
  assignedTo: string;
  dueDate: string;
  startDate: string | null;
  done: boolean;
  notes: string;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type DeliverablePatch = Partial<
  Pick<Deliverable, "title" | "assignedTo" | "dueDate" | "startDate" | "done" | "notes">
> & {
  actor?: string | null;
};

export type MediaItem = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string | null;
  durationSeconds?: number | null;
};

export type BoardSnapshot = {
  leads: Lead[];
  guests: Guest[];
  members: Member[];
  settings: Settings;
  deliverables: Deliverable[];
  media: MediaItem[];
  mediaDeletedIds: string[];
  writtenAt: string | null;
};

export type SetlistCue = {
  id: string;
  label: string;
  timestamp: string;
  seconds: number;
  url: string;
};

export const OUTCOME_CHIPS = [
  "Waiting for reply",
  "Meeting booked",
  "Confirmed sponsor",
  "In-kind support",
  "Declined",
  "Can't reach",
] as const;

/**
 * Full-card glow classes (globals.css). Strong ring + halo so they read on a
 * phone dark theme. Applied on the outer Money/Calls card, not an inner node.
 */
export const DECLINED_GLOW_CLASS = "lead-glow-declined";

/** Green glow for pledged or received money (Calls + Money). */
export const MONEY_GLOW_CLASS = "lead-glow-money";

/** Yellow glow for in-progress / waiting (Calls + Money). */
export const PROGRESS_GLOW_CLASS = "lead-glow-progress";

export const DECLINED_PILL_CLASS =
  "inline-flex items-center rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-semibold text-white shadow-[0_0_10px_rgba(239,68,68,0.7)]";

export const MONEY_PILL_CLASS =
  "inline-flex items-center rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-semibold text-white shadow-[0_0_10px_rgba(16,185,129,0.65)]";

export const PROGRESS_PILL_CLASS =
  "inline-flex items-center rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-semibold text-zinc-950 shadow-[0_0_10px_rgba(251,191,36,0.75)]";

/** Stamped when Mark in progress is tapped and the outcome is empty. */
export const WAITING_STAMP = "Waiting for reply.";

export function hasLeadMoney(lead: {
  committed?: number | null;
  received?: number | null;
}): boolean {
  return (Number(lead.committed) || 0) > 0 || (Number(lead.received) || 0) > 0;
}

/**
 * Glow precedence:
 * 1. Declined → red (even with money or waiting notes)
 * 2. Pledged/received money → green (money beats “waiting”)
 * 3. In progress / waiting language or inProgress flag → yellow
 * 4. Else none
 */
export function leadGlowClass(lead: {
  declined?: boolean | null;
  inProgress?: boolean | null;
  done?: boolean | null;
  outcome?: string | null;
  notes?: string | null;
  committed?: number | null;
  received?: number | null;
}): string | undefined {
  if (isLeadDeclined(lead)) return DECLINED_GLOW_CLASS;
  if (hasLeadMoney(lead)) return MONEY_GLOW_CLASS;
  if (isLeadInProgress(lead)) return PROGRESS_GLOW_CLASS;
  return undefined;
}

/** True when the yellow glow would apply (after declined/money precedence). */
export function leadShowsProgressGlow(lead: {
  declined?: boolean | null;
  inProgress?: boolean | null;
  done?: boolean | null;
  outcome?: string | null;
  notes?: string | null;
  committed?: number | null;
  received?: number | null;
}): boolean {
  return leadGlowClass(lead) === PROGRESS_GLOW_CLASS;
}

const DECLINED_OUTCOME_RE =
  /declined|said\s+no|not\s+interested|won['’]?t\s+sponsor|not\s+sponsoring|turned\s+down|\brejected\b|\bpass\b|\bnope\b|\bno thanks\b/i;

export function isDeclinedOutcome(outcome: string | null | undefined): boolean {
  const text = (outcome ?? "").trim();
  if (!text) return false;
  return DECLINED_OUTCOME_RE.test(text);
}

/**
 * Persist and display the same rule: explicit `declined: true` always wins,
 * and declined language in outcome/notes still counts even when the flag is
 * missing or stored as false (legacy rows).
 */
export function resolveLeadDeclined(lead: {
  declined?: boolean | null;
  outcome?: string | null;
  notes?: string | null;
}): boolean {
  if (lead.declined === true) return true;
  return isDeclinedOutcome(lead.outcome) || isDeclinedOutcome(lead.notes);
}

export function isLeadDeclined(lead: {
  declined?: boolean | null;
  outcome?: string | null;
  notes?: string | null;
}): boolean {
  return resolveLeadDeclined(lead);
}

const IN_PROGRESS_OUTCOME_RE =
  /\b(?:waiting|wait|reply|meeting|booked|scheduled|follow[\s-]+up|called|left\s+voicemail|voicemail|emailed|sent|pending|in\s+progress|working|callback|call\s+back)\b/i;

const WAITING_LABEL_RE =
  /\b(?:waiting|wait|reply|callback|call\s+back|pending|voicemail|left\s+voicemail)\b/i;

export function isInProgressOutcome(outcome: string | null | undefined): boolean {
  const text = (outcome ?? "").trim();
  if (!text) return false;
  return IN_PROGRESS_OUTCOME_RE.test(text);
}

export function isStampedWaitingOutcome(outcome: string | null | undefined): boolean {
  return /^(waiting for reply\.?)$/i.test((outcome ?? "").trim());
}

/**
 * Yellow means work is in motion: explicit flag, or waiting/meeting language
 * in outcome/notes. Completed leads do not get yellow from the flag alone —
 * only if the outcome still matches.
 */
export function resolveLeadInProgress(lead: {
  inProgress?: boolean | null;
  done?: boolean | null;
  outcome?: string | null;
  notes?: string | null;
}): boolean {
  if (isInProgressOutcome(lead.outcome) || isInProgressOutcome(lead.notes)) {
    return true;
  }
  if (lead.inProgress === true && lead.done !== true) return true;
  return false;
}

export function isLeadInProgress(lead: {
  inProgress?: boolean | null;
  done?: boolean | null;
  outcome?: string | null;
  notes?: string | null;
}): boolean {
  return resolveLeadInProgress(lead);
}

export function leadProgressLabel(lead: {
  outcome?: string | null;
  notes?: string | null;
}): "Waiting" | "In progress" {
  const text = `${lead.outcome ?? ""} ${lead.notes ?? ""}`;
  if (WAITING_LABEL_RE.test(text)) return "Waiting";
  return "In progress";
}

export const GUEST_STATUSES: { id: GuestStatus; label: string }[] = [
  { id: "not_called", label: "Not called" },
  { id: "confirmed", label: "Confirmed" },
  { id: "tentative", label: "Tentative" },
  { id: "declined", label: "Declined" },
];

export function displayGuestName(guest: {
  firstName?: string;
  lastName?: string;
  name?: string;
}): string {
  const combined = `${guest.firstName ?? ""} ${guest.lastName ?? ""}`.trim();
  return combined || guest.name || "Unknown";
}

export function e164Canada(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length !== 10) return null;
  return `+1${local}`;
}

export function telHref(phone: string): string | null {
  const e164 = e164Canada(phone);
  return e164 ? `tel:${e164}` : null;
}

/** Opens the phone SMS app. Optional body is prefilled (iPhone + Android). */
export function smsHref(phone: string, body?: string): string | null {
  const e164 = e164Canada(phone);
  if (!e164) return null;
  if (!body?.trim()) return `sms:${e164}`;
  return `sms:${e164}?body=${encodeURIComponent(body.trim())}`;
}

export function normalizeGuestStatus(status: string | undefined | null): GuestStatus {
  if (status === "confirmed") return "confirmed";
  if (status === "tentative" || status === "maybe") return "tentative";
  if (status === "declined") return "declined";
  return "not_called";
}

export const MONEY_CHIPS = [250, 500, 1000, 2000, 5000];

export const REMINDER_TEXT =
  "Hey! Reminder about the Artcell Edmonton show — grab your tickets and come through. Let me know if you need the link.";

export function normalizeContactVia(value: string | null | undefined): ContactVia | null {
  return value === "call" || value === "text" ? value : null;
}

export function normalizeContactLog(value: unknown): ContactEvent[] {
  if (!Array.isArray(value)) return [];
  const rows: ContactEvent[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<ContactEvent>;
    const via = normalizeContactVia(row.via);
    const at = typeof row.at === "string" ? row.at : "";
    if (!via || !at) continue;
    rows.push({
      at,
      via,
      by: typeof row.by === "string" && row.by.trim() ? row.by.trim() : null,
    });
  }
  return rows.slice(0, 8);
}

export function latestContact(guest: Guest, via: ContactVia): ContactEvent | null {
  return normalizeContactLog(guest.contactLog).find((event) => event.via === via) ?? null;
}

export function hasBeenCalled(guest: Guest): boolean {
  return Boolean(guest.lastCalledAt || latestContact(guest, "call"));
}

export function hasBeenTexted(guest: Guest): boolean {
  return Boolean(guest.lastTextedAt || latestContact(guest, "text"));
}

export function inviteSmsBody(ticketUrl?: string | null): string {
  const link = (ticketUrl ?? "").trim();
  if (link) {
    return `Hey! Artcell is in Edmonton Sep 20. Tickets: ${link}`;
  }
  return REMINDER_TEXT;
}
