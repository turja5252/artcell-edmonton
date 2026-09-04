import { promises as fs } from "fs";
import path from "path";

import { uniqueId } from "@/lib/ids";
import { parseCount, parseMoney } from "@/lib/money";
import type {
  Guest,
  GuestPatch,
  GuestStatus,
  Lead,
  LeadPatch,
  Settings,
} from "@/lib/types";

const LEADS_PATH = path.join(process.cwd(), "data", "leads.json");
const GUESTS_PATH = path.join(process.cwd(), "data", "guests.json");
const SETTINGS_PATH = path.join(process.cwd(), "data", "settings.json");

const DEFAULT_SETTINGS: Settings = { moneyTarget: 0, attendanceTarget: 0 };

let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function stamp<T extends { updatedAt: string | null; updatedBy: string | null }>(
  item: T,
  actor?: string | null
): T {
  return {
    ...item,
    updatedAt: new Date().toISOString(),
    updatedBy: actor?.trim() || item.updatedBy,
  };
}

function normalizeLead(lead: Partial<Lead> & { company: string; id: string }): Lead {
  return {
    id: lead.id,
    company: lead.company,
    assignedTo: lead.assignedTo?.trim() || null,
    done: Boolean(lead.done),
    outcome: lead.outcome ?? "",
    committed: parseMoney(lead.committed),
    received: parseMoney(lead.received),
    updatedAt: lead.updatedAt ?? null,
    updatedBy: lead.updatedBy ?? null,
  };
}

function normalizeGuest(guest: Partial<Guest> & { name: string; id: string }): Guest {
  const status = guest.status ?? "not_reached";
  const allowed: GuestStatus[] = [
    "not_reached",
    "reached",
    "maybe",
    "confirmed",
    "declined",
  ];
  return {
    id: guest.id,
    name: guest.name,
    assignedTo: guest.assignedTo?.trim() || null,
    status: allowed.includes(status) ? status : "not_reached",
    partySize: Math.max(1, parseCount(guest.partySize) || 1),
    notes: guest.notes ?? "",
    updatedAt: guest.updatedAt ?? null,
    updatedBy: guest.updatedBy ?? null,
  };
}

async function readLeadsFile(): Promise<Lead[]> {
  const raw = await fs.readFile(LEADS_PATH, "utf8");
  const parsed = JSON.parse(raw) as Lead[];
  return parsed.map((lead) => normalizeLead(lead));
}

async function writeLeadsFile(leads: Lead[]) {
  await fs.writeFile(LEADS_PATH, `${JSON.stringify(leads, null, 2)}\n`, "utf8");
}

async function readGuestsFile(): Promise<Guest[]> {
  try {
    const raw = await fs.readFile(GUESTS_PATH, "utf8");
    const parsed = JSON.parse(raw) as Guest[];
    return parsed.map((guest) => normalizeGuest(guest));
  } catch {
    return [];
  }
}

async function writeGuestsFile(guests: Guest[]) {
  await fs.writeFile(GUESTS_PATH, `${JSON.stringify(guests, null, 2)}\n`, "utf8");
}

async function readSettingsFile(): Promise<Settings> {
  try {
    const raw = await fs.readFile(SETTINGS_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      moneyTarget: parseMoney(parsed.moneyTarget),
      attendanceTarget: parseCount(parsed.attendanceTarget),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

async function writeSettingsFile(settings: Settings) {
  await fs.writeFile(SETTINGS_PATH, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

export function listLeads(): Promise<Lead[]> {
  return enqueue(readLeadsFile);
}

export function listGuests(): Promise<Guest[]> {
  return enqueue(readGuestsFile);
}

export function getSettings(): Promise<Settings> {
  return enqueue(readSettingsFile);
}

export function getBoard(): Promise<{
  leads: Lead[];
  guests: Guest[];
  settings: Settings;
}> {
  return enqueue(async () => ({
    leads: await readLeadsFile(),
    guests: await readGuestsFile(),
    settings: await readSettingsFile(),
  }));
}

export function createLead(input: {
  company: string;
  assignedTo?: string | null;
  actor?: string | null;
}): Promise<Lead> {
  return enqueue(async () => {
    const company = input.company.trim();
    if (!company) throw new Error("Company name is required");
    const leads = await readLeadsFile();
    const lead = stamp(
      normalizeLead({
        id: uniqueId(
          company,
          leads.map((item) => item.id)
        ),
        company,
        assignedTo: input.assignedTo?.trim() || null,
        done: false,
        outcome: "",
        committed: 0,
        received: 0,
        updatedAt: null,
        updatedBy: null,
      }),
      input.actor
    );
    leads.push(lead);
    await writeLeadsFile(leads);
    return lead;
  });
}

export function patchLead(id: string, patch: LeadPatch): Promise<Lead> {
  return enqueue(async () => {
    const leads = await readLeadsFile();
    const index = leads.findIndex((lead) => lead.id === id);
    if (index === -1) throw new Error("Lead not found");
    const current = leads[index];
    const next = stamp(
      normalizeLead({
        ...current,
        company: patch.company?.trim() || current.company,
        assignedTo:
          patch.assignedTo === undefined
            ? current.assignedTo
            : patch.assignedTo?.trim() || null,
        done: patch.done ?? current.done,
        outcome: patch.outcome === undefined ? current.outcome : patch.outcome,
        committed:
          patch.committed === undefined ? current.committed : parseMoney(patch.committed),
        received:
          patch.received === undefined ? current.received : parseMoney(patch.received),
      }),
      patch.actor
    );
    leads[index] = next;
    await writeLeadsFile(leads);
    return next;
  });
}

export function mergeSheetRows(
  rows: { company: string; assignedTo: string | null }[],
  actor?: string | null
): Promise<{ leads: Lead[]; added: number }> {
  return enqueue(async () => {
    const leads = await readLeadsFile();
    const existing = new Set(leads.map((lead) => lead.company.trim().toLowerCase()));
    let added = 0;
    for (const row of rows) {
      const company = row.company.trim();
      if (!company || existing.has(company.toLowerCase())) continue;
      leads.push(
        stamp(
          normalizeLead({
            id: uniqueId(
              company,
              leads.map((item) => item.id)
            ),
            company,
            assignedTo: row.assignedTo?.trim() || null,
            done: false,
            outcome: "",
            committed: 0,
            received: 0,
            updatedAt: null,
            updatedBy: null,
          }),
          actor
        )
      );
      existing.add(company.toLowerCase());
      added += 1;
    }
    await writeLeadsFile(leads);
    return { leads, added };
  });
}

export function createGuest(input: {
  name: string;
  assignedTo?: string | null;
  partySize?: number;
  actor?: string | null;
}): Promise<Guest> {
  return enqueue(async () => {
    const name = input.name.trim();
    if (!name) throw new Error("Name is required");
    const guests = await readGuestsFile();
    const guest = stamp(
      normalizeGuest({
        id: uniqueId(
          name,
          guests.map((item) => item.id)
        ),
        name,
        assignedTo: input.assignedTo?.trim() || null,
        status: "not_reached",
        partySize: input.partySize ?? 1,
        notes: "",
        updatedAt: null,
        updatedBy: null,
      }),
      input.actor
    );
    guests.push(guest);
    await writeGuestsFile(guests);
    return guest;
  });
}

export function patchGuest(id: string, patch: GuestPatch): Promise<Guest> {
  return enqueue(async () => {
    const guests = await readGuestsFile();
    const index = guests.findIndex((guest) => guest.id === id);
    if (index === -1) throw new Error("Guest not found");
    const current = guests[index];
    const next = stamp(
      normalizeGuest({
        ...current,
        name: patch.name?.trim() || current.name,
        assignedTo:
          patch.assignedTo === undefined
            ? current.assignedTo
            : patch.assignedTo?.trim() || null,
        status: patch.status ?? current.status,
        partySize: patch.partySize === undefined ? current.partySize : patch.partySize,
        notes: patch.notes === undefined ? current.notes : patch.notes,
      }),
      patch.actor
    );
    guests[index] = next;
    await writeGuestsFile(guests);
    return next;
  });
}

export function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  return enqueue(async () => {
    const current = await readSettingsFile();
    const next: Settings = {
      moneyTarget:
        patch.moneyTarget === undefined
          ? current.moneyTarget
          : parseMoney(patch.moneyTarget),
      attendanceTarget:
        patch.attendanceTarget === undefined
          ? current.attendanceTarget
          : parseCount(patch.attendanceTarget),
    };
    await writeSettingsFile(next);
    return next;
  });
}
