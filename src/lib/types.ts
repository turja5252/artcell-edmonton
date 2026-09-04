export type Member = {
  id: string;
  name: string;
  phone: string;
  email: string;
};

export type MemberPatch = Partial<Pick<Member, "name" | "phone" | "email">> & {
  actor?: string | null;
};

export type Lead = {
  id: string;
  company: string;
  assignedTo: string | null;
  done: boolean;
  outcome: string;
  committed: number;
  received: number;
  receivedBy: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type LeadPatch = Partial<
  Pick<
    Lead,
    "assignedTo" | "done" | "outcome" | "company" | "committed" | "received" | "receivedBy"
  >
> & {
  actor?: string | null;
};

export type GuestStatus =
  | "not_reached"
  | "reached"
  | "reminded"
  | "maybe"
  | "confirmed"
  | "declined";

export type Guest = {
  id: string;
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

export const GUEST_STATUSES: { id: GuestStatus; label: string }[] = [
  { id: "not_reached", label: "Not reached" },
  { id: "reached", label: "Reached" },
  { id: "reminded", label: "Reminded" },
  { id: "maybe", label: "Maybe" },
  { id: "confirmed", label: "Confirmed" },
  { id: "declined", label: "Declined" },
];

export const MONEY_CHIPS = [250, 500, 1000, 2000, 5000];

export const REMINDER_TEXT =
  "Hey! Reminder about the Artcell Edmonton show — grab your tickets and come through. Let me know if you need the link.";
