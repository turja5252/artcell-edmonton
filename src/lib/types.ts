export type Lead = {
  id: string;
  company: string;
  assignedTo: string | null;
  done: boolean;
  outcome: string;
  committed: number;
  received: number;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type LeadPatch = Partial<
  Pick<Lead, "assignedTo" | "done" | "outcome" | "company" | "committed" | "received">
> & {
  actor?: string | null;
};

export type GuestStatus = "not_reached" | "reached" | "maybe" | "confirmed" | "declined";

export type Guest = {
  id: string;
  name: string;
  assignedTo: string | null;
  status: GuestStatus;
  partySize: number;
  notes: string;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type GuestPatch = Partial<
  Pick<Guest, "name" | "assignedTo" | "status" | "partySize" | "notes">
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
  { id: "maybe", label: "Maybe" },
  { id: "confirmed", label: "Confirmed" },
  { id: "declined", label: "Declined" },
];

export const MONEY_CHIPS = [250, 500, 1000, 2000, 5000];
