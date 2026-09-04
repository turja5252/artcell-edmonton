export type Lead = {
  id: string;
  company: string;
  assignedTo: string | null;
  done: boolean;
  outcome: string;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type LeadPatch = Partial<
  Pick<Lead, "assignedTo" | "done" | "outcome" | "company">
> & {
  actor?: string | null;
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
