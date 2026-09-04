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
    | "notes"
  >
> & {
  actor?: string | null;
};

export type Settings = {
  moneyTarget: number;
  attendanceTarget: number;
  ticketsSold: number;
  ticketsSoldUpdatedAt: string | null;
  ticketsSoldUpdatedBy: string | null;
};

export type BoardSnapshot = {
  leads: Lead[];
  guests: Guest[];
  members: Member[];
  settings: Settings;
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

/** Ring + red glow for declined sponsor cards (Calls + Money). Not a full red fill. */
export const DECLINED_GLOW_CLASS =
  "ring-2 ring-destructive shadow-[0_0_18px_2px_rgba(239,68,68,0.42)]";

/** Ring + green glow for pledged or received money (Calls + Money). */
export const MONEY_GLOW_CLASS =
  "ring-2 ring-emerald-400/80 shadow-[0_0_18px_2px_rgba(16,185,129,0.45)]";

export function hasLeadMoney(lead: {
  committed?: number | null;
  received?: number | null;
}): boolean {
  return (Number(lead.committed) || 0) > 0 || (Number(lead.received) || 0) > 0;
}

/**
 * Glow precedence: declined red wins even if they pledged or paid.
 * Then green if committed or received is above zero. Otherwise no glow.
 */
export function leadGlowClass(lead: {
  declined?: boolean | null;
  outcome?: string | null;
  notes?: string | null;
  committed?: number | null;
  received?: number | null;
}): string | undefined {
  if (isLeadDeclined(lead)) return DECLINED_GLOW_CLASS;
  if (hasLeadMoney(lead)) return MONEY_GLOW_CLASS;
  return undefined;
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

export function telHref(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length !== 10) return null;
  return `tel:+1${local}`;
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
