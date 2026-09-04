import { uniqueId } from "@/lib/ids";
import { parseCount, parseMoney } from "@/lib/money";
import type {
  Guest,
  GuestPatch,
  Lead,
  LeadAttachment,
  LeadPatch,
  Member,
  MemberPatch,
  Settings,
} from "@/lib/types";
import { displayGuestName, normalizeGuestStatus } from "@/lib/types";
import {
  assertAllowedAttachment,
  deleteAttachmentFile,
  newAttachmentId,
  removeLeadUploadDir,
  safeDownloadName,
  writeAttachmentFile,
} from "@/lib/attachments";
import { readJsonFile, writeJsonFile } from "@/lib/persist";

const LEADS_FILE = "leads.json";
const GUESTS_FILE = "guests.json";
const MEMBERS_FILE = "members.json";
const SETTINGS_FILE = "settings.json";

const DEFAULT_SETTINGS: Settings = {
  moneyTarget: 0,
  attendanceTarget: 0,
  ticketsSold: 0,
  ticketsSoldUpdatedAt: null,
  ticketsSoldUpdatedBy: null,
};

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

function normalizeAttachment(raw: Partial<LeadAttachment> & { id: string; fileName: string }): LeadAttachment {
  return {
    id: raw.id,
    fileName: raw.fileName,
    mimeType: raw.mimeType || "application/octet-stream",
    size: Number(raw.size) || 0,
    uploadedAt: raw.uploadedAt || new Date().toISOString(),
    uploadedBy: raw.uploadedBy?.trim() || null,
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
    receivedBy: lead.receivedBy?.trim() || null,
    attachments: Array.isArray(lead.attachments)
      ? lead.attachments
          .filter((item): item is LeadAttachment => Boolean(item?.id && item?.fileName))
          .map((item) => normalizeAttachment(item))
      : [],
    updatedAt: lead.updatedAt ?? null,
    updatedBy: lead.updatedBy ?? null,
  };
}

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

function normalizeGuest(
  guest: Partial<Guest> & { id: string; name?: string; firstName?: string; lastName?: string }
): Guest {
  let firstName = guest.firstName?.trim() || "";
  let lastName = guest.lastName?.trim() || "";
  const rawName = guest.name?.trim() || "";
  if (!firstName && !lastName && rawName) {
    const split = splitName(rawName);
    firstName = split.firstName;
    lastName = split.lastName;
  }
  const name = displayGuestName({ firstName, lastName, name: rawName });
  return {
    id: guest.id,
    firstName,
    lastName,
    name,
    phone: guest.phone?.trim() || "",
    email: guest.email?.trim() || "",
    assignedTo: guest.assignedTo?.trim() || null,
    status: normalizeGuestStatus(guest.status),
    partySize: Math.max(1, parseCount(guest.partySize) || 1),
    ticketBought: Boolean(guest.ticketBought),
    lastContactedAt: guest.lastContactedAt ?? null,
    notes: guest.notes ?? "",
    updatedAt: guest.updatedAt ?? null,
    updatedBy: guest.updatedBy ?? null,
  };
}

async function readLeadsFile(): Promise<Lead[]> {
  const parsed = await readJsonFile<Lead[]>(LEADS_FILE, []);
  return parsed.map((lead) => normalizeLead(lead));
}

async function writeLeadsFile(leads: Lead[]) {
  await writeJsonFile(LEADS_FILE, leads);
}

async function readGuestsFile(): Promise<Guest[]> {
  const parsed = await readJsonFile<Guest[]>(GUESTS_FILE, []);
  return parsed.map((guest) => normalizeGuest(guest));
}

async function writeGuestsFile(guests: Guest[]) {
  await writeJsonFile(GUESTS_FILE, guests);
}

function normalizeMember(member: Partial<Member> & { name: string; id: string }): Member {
  return {
    id: member.id,
    name: member.name.trim(),
    phone: member.phone?.trim() || "",
    email: member.email?.trim() || "",
  };
}

async function readMembersFile(): Promise<Member[]> {
  const parsed = await readJsonFile<Member[]>(MEMBERS_FILE, []);
  return parsed
    .map((member) => normalizeMember(member))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function writeMembersFile(members: Member[]) {
  await writeJsonFile(
    MEMBERS_FILE,
    [...members].sort((a, b) => a.name.localeCompare(b.name))
  );
}

async function readSettingsFile(): Promise<Settings> {
  const parsed = await readJsonFile<Partial<Settings>>(SETTINGS_FILE, DEFAULT_SETTINGS);
  return {
    moneyTarget: parseMoney(parsed.moneyTarget),
    attendanceTarget: parseCount(parsed.attendanceTarget),
    ticketsSold: parseCount(parsed.ticketsSold),
    ticketsSoldUpdatedAt: parsed.ticketsSoldUpdatedAt ?? null,
    ticketsSoldUpdatedBy: parsed.ticketsSoldUpdatedBy?.trim() || null,
  };
}

async function writeSettingsFile(settings: Settings) {
  await writeJsonFile(SETTINGS_FILE, settings);
}

export function listLeads(): Promise<Lead[]> {
  return enqueue(readLeadsFile);
}

export function listGuests(): Promise<Guest[]> {
  return enqueue(readGuestsFile);
}

export function listMembers(): Promise<Member[]> {
  return enqueue(readMembersFile);
}

export function getSettings(): Promise<Settings> {
  return enqueue(readSettingsFile);
}

export function getBoard(): Promise<{
  leads: Lead[];
  guests: Guest[];
  members: Member[];
  settings: Settings;
}> {
  return enqueue(async () => {
    const members = await readMembersFile();
    const allowed = new Set(members.map((member) => member.name));
    const leadsRaw = await readLeadsFile();
    const guestsRaw = await readGuestsFile();
    const leads = clearMissingLeadAssignees(leadsRaw, allowed);
    const guests = clearMissingGuestAssignees(guestsRaw, allowed);
    if (
      leads.some((lead, index) => lead !== leadsRaw[index]) ||
      guests.some((guest, index) => guest !== guestsRaw[index])
    ) {
      await writeLeadsFile(leads);
      await writeGuestsFile(guests);
    }
    return {
      leads,
      guests,
      members,
      settings: await readSettingsFile(),
    };
  });
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
        receivedBy: null,
        attachments: [],
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
    const received =
      patch.received === undefined ? current.received : parseMoney(patch.received);
    let receivedBy =
      patch.receivedBy === undefined
        ? current.receivedBy
        : patch.receivedBy?.trim() || null;
    if (received > 0 && !receivedBy && patch.actor?.trim()) {
      receivedBy = patch.actor.trim();
    }
    if (received === 0 && patch.received !== undefined) {
      receivedBy = patch.receivedBy === undefined ? null : receivedBy;
    }
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
        received,
        receivedBy,
        attachments: current.attachments,
      }),
      patch.actor
    );
    leads[index] = next;
    await writeLeadsFile(leads);
    return next;
  });
}

export function deleteLead(id: string): Promise<void> {
  return enqueue(async () => {
    const leads = await readLeadsFile();
    const next = leads.filter((lead) => lead.id !== id);
    if (next.length === leads.length) throw new Error("Lead not found");
    await writeLeadsFile(next);
    await removeLeadUploadDir(id);
  });
}

export function addLeadAttachment(input: {
  leadId: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  actor?: string | null;
}): Promise<{ lead: Lead; attachment: LeadAttachment }> {
  return enqueue(async () => {
    const leads = await readLeadsFile();
    const index = leads.findIndex((lead) => lead.id === input.leadId);
    if (index === -1) throw new Error("Lead not found");
    const current = leads[index];
    const mimeType = assertAllowedAttachment(
      input.fileName,
      input.mimeType,
      input.bytes.length
    );
    const attachment = normalizeAttachment({
      id: newAttachmentId(),
      fileName: safeDownloadName(input.fileName),
      mimeType,
      size: input.bytes.length,
      uploadedAt: new Date().toISOString(),
      uploadedBy: input.actor?.trim() || null,
    });
    await writeAttachmentFile(
      current.id,
      attachment.id,
      attachment.fileName,
      input.bytes,
      mimeType
    );
    const next = stamp(
      normalizeLead({
        ...current,
        attachments: [...current.attachments, attachment],
      }),
      input.actor
    );
    leads[index] = next;
    await writeLeadsFile(leads);
    return { lead: next, attachment };
  });
}

export function removeLeadAttachment(
  leadId: string,
  attachmentId: string,
  actor?: string | null
): Promise<Lead> {
  return enqueue(async () => {
    const leads = await readLeadsFile();
    const index = leads.findIndex((lead) => lead.id === leadId);
    if (index === -1) throw new Error("Lead not found");
    const current = leads[index];
    const attachment = current.attachments.find((item) => item.id === attachmentId);
    if (!attachment) throw new Error("File not found");
    await deleteAttachmentFile(leadId, attachment);
    const next = stamp(
      normalizeLead({
        ...current,
        attachments: current.attachments.filter((item) => item.id !== attachmentId),
      }),
      actor
    );
    leads[index] = next;
    await writeLeadsFile(leads);
    return next;
  });
}

export function getLeadAttachment(
  leadId: string,
  attachmentId: string
): Promise<{ lead: Lead; attachment: LeadAttachment }> {
  return enqueue(async () => {
    const leads = await readLeadsFile();
    const lead = leads.find((item) => item.id === leadId);
    if (!lead) throw new Error("Lead not found");
    const attachment = lead.attachments.find((item) => item.id === attachmentId);
    if (!attachment) throw new Error("File not found");
    return { lead, attachment };
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
            receivedBy: null,
            attachments: [],
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
  name?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  assignedTo?: string | null;
  partySize?: number;
  actor?: string | null;
}): Promise<Guest> {
  return enqueue(async () => {
    const guests = await readGuestsFile();
    const guest = buildGuest(input, guests);
    guests.push(guest);
    await writeGuestsFile(guests);
    return guest;
  });
}

export function createGuests(
  inputs: {
    name?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    assignedTo?: string | null;
    partySize?: number;
  }[],
  actor?: string | null
): Promise<{ guests: Guest[]; added: number; skipped: number }> {
  return enqueue(async () => {
    if (!inputs.length) throw new Error("No contacts to add");
    const guests = await readGuestsFile();
    const existingKeys = new Set(
      guests.map(
        (guest) =>
          `${guest.firstName}|${guest.lastName}|${guest.phone.replace(/\D/g, "")}`.toLowerCase()
      )
    );
    const created: Guest[] = [];
    let skipped = 0;
    for (const input of inputs) {
      const firstName = input.firstName?.trim() || "";
      const lastName = input.lastName?.trim() || "";
      const name = `${firstName} ${lastName}`.trim() || input.name?.trim() || "";
      if (!name) {
        skipped += 1;
        continue;
      }
      const phone = input.phone?.trim() || "";
      const key = `${firstName}|${lastName}|${phone.replace(/\D/g, "")}`.toLowerCase();
      if (existingKeys.has(key)) {
        skipped += 1;
        continue;
      }
      const guest = buildGuest(
        { ...input, firstName, lastName, name, phone, actor },
        [...guests, ...created]
      );
      created.push(guest);
      existingKeys.add(key);
    }
    if (created.length) {
      guests.push(...created);
      await writeGuestsFile(guests);
    }
    return { guests: created, added: created.length, skipped };
  });
}

function buildGuest(
  input: {
    name?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    assignedTo?: string | null;
    partySize?: number;
    actor?: string | null;
  },
  existing: Guest[]
): Guest {
  const firstName = input.firstName?.trim() || "";
  const lastName = input.lastName?.trim() || "";
  const name = `${firstName} ${lastName}`.trim() || input.name?.trim() || "";
  if (!name) throw new Error("Name is required");
  return stamp(
    normalizeGuest({
      id: uniqueId(
        name,
        existing.map((item) => item.id)
      ),
      firstName,
      lastName,
      name,
      phone: input.phone ?? "",
      email: input.email ?? "",
      assignedTo: input.assignedTo?.trim() || null,
      status: "not_called",
      partySize: input.partySize ?? 1,
      ticketBought: false,
      lastContactedAt: null,
      notes: "",
      updatedAt: null,
      updatedBy: null,
    }),
    input.actor
  );
}

export function patchGuest(id: string, patch: GuestPatch): Promise<Guest> {
  return enqueue(async () => {
    const guests = await readGuestsFile();
    const index = guests.findIndex((guest) => guest.id === id);
    if (index === -1) throw new Error("Guest not found");
    const current = guests[index];
    const firstName =
      patch.firstName === undefined ? current.firstName : patch.firstName.trim();
    const lastName =
      patch.lastName === undefined ? current.lastName : patch.lastName.trim();
    const nameFromParts = `${firstName} ${lastName}`.trim();
    const next = stamp(
      normalizeGuest({
        ...current,
        firstName,
        lastName,
        name: nameFromParts || patch.name?.trim() || current.name,
        phone: patch.phone === undefined ? current.phone : patch.phone,
        email: patch.email === undefined ? current.email : patch.email,
        assignedTo:
          patch.assignedTo === undefined
            ? current.assignedTo
            : patch.assignedTo?.trim() || null,
        status: patch.status ?? current.status,
        partySize: patch.partySize === undefined ? current.partySize : patch.partySize,
        ticketBought:
          patch.ticketBought === undefined ? current.ticketBought : patch.ticketBought,
        lastContactedAt:
          patch.lastContactedAt === undefined
            ? current.lastContactedAt
            : patch.lastContactedAt,
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
    const ticketsTouched = patch.ticketsSold !== undefined;
    const next: Settings = {
      moneyTarget:
        patch.moneyTarget === undefined
          ? current.moneyTarget
          : parseMoney(patch.moneyTarget),
      attendanceTarget:
        patch.attendanceTarget === undefined
          ? current.attendanceTarget
          : parseCount(patch.attendanceTarget),
      ticketsSold:
        patch.ticketsSold === undefined
          ? current.ticketsSold
          : parseCount(patch.ticketsSold),
      ticketsSoldUpdatedAt: ticketsTouched
        ? patch.ticketsSoldUpdatedAt?.trim() || new Date().toISOString()
        : patch.ticketsSoldUpdatedAt === undefined
          ? current.ticketsSoldUpdatedAt
          : patch.ticketsSoldUpdatedAt,
      ticketsSoldUpdatedBy: ticketsTouched
        ? patch.ticketsSoldUpdatedBy?.trim() || current.ticketsSoldUpdatedBy
        : patch.ticketsSoldUpdatedBy === undefined
          ? current.ticketsSoldUpdatedBy
          : patch.ticketsSoldUpdatedBy?.trim() || null,
    };
    await writeSettingsFile(next);
    return next;
  });
}

export function createMember(input: {
  name: string;
  phone?: string;
  email?: string;
}): Promise<Member> {
  return enqueue(async () => {
    const name = input.name.trim();
    if (!name) throw new Error("Name is required");
    const members = await readMembersFile();
    const existing = members.find(
      (member) => member.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) return existing;
    const member = normalizeMember({
      id: uniqueId(
        name,
        members.map((item) => item.id)
      ),
      name,
      phone: input.phone ?? "",
      email: input.email ?? "",
    });
    members.push(member);
    await writeMembersFile(members);
    return member;
  });
}

export function patchMember(id: string, patch: MemberPatch): Promise<Member> {
  return enqueue(async () => {
    const members = await readMembersFile();
    const index = members.findIndex((member) => member.id === id);
    if (index === -1) throw new Error("Member not found");
    const current = members[index];
    const nextName = patch.name?.trim() || current.name;
    if (
      members.some(
        (member) =>
          member.id !== id && member.name.toLowerCase() === nextName.toLowerCase()
      )
    ) {
      throw new Error("That name is already on the team");
    }
    const next = normalizeMember({
      ...current,
      name: nextName,
      phone: patch.phone === undefined ? current.phone : patch.phone,
      email: patch.email === undefined ? current.email : patch.email,
    });
    members[index] = next;
    await writeMembersFile(members);

    if (next.name !== current.name) {
      const leads = await readLeadsFile();
      let leadsChanged = false;
      for (let i = 0; i < leads.length; i++) {
        const lead = leads[i];
        let changed = false;
        const updated = { ...lead };
        if (lead.assignedTo === current.name) {
          updated.assignedTo = next.name;
          changed = true;
        }
        if (lead.receivedBy === current.name) {
          updated.receivedBy = next.name;
          changed = true;
        }
        if (lead.updatedBy === current.name) {
          updated.updatedBy = next.name;
          changed = true;
        }
        if (changed) {
          leads[i] = updated;
          leadsChanged = true;
        }
      }
      if (leadsChanged) await writeLeadsFile(leads);

      const guests = await readGuestsFile();
      let guestsChanged = false;
      for (let i = 0; i < guests.length; i++) {
        const guest = guests[i];
        let changed = false;
        const updated = { ...guest };
        if (guest.assignedTo === current.name) {
          updated.assignedTo = next.name;
          changed = true;
        }
        if (guest.updatedBy === current.name) {
          updated.updatedBy = next.name;
          changed = true;
        }
        if (changed) {
          guests[i] = updated;
          guestsChanged = true;
        }
      }
      if (guestsChanged) await writeGuestsFile(guests);
    }

    return next;
  });
}

export function deleteMember(id: string): Promise<{
  members: Member[];
  leads: Lead[];
  guests: Guest[];
}> {
  return enqueue(async () => {
    const members = await readMembersFile();
    const target = members.find((member) => member.id === id);
    if (!target) throw new Error("Member not found");
    const nextMembers = members.filter((member) => member.id !== id);
    await writeMembersFile(nextMembers);

    const allowed = new Set(nextMembers.map((member) => member.name));
    const leads = clearMissingLeadAssignees(await readLeadsFile(), allowed);
    const guests = clearMissingGuestAssignees(await readGuestsFile(), allowed);
    await writeLeadsFile(leads);
    await writeGuestsFile(guests);

    return { members: nextMembers, leads, guests };
  });
}

function clearMissingLeadAssignees(leads: Lead[], allowed: Set<string>): Lead[] {
  return leads.map((lead) => ({
    ...lead,
    assignedTo: lead.assignedTo && allowed.has(lead.assignedTo) ? lead.assignedTo : null,
    receivedBy: lead.receivedBy && allowed.has(lead.receivedBy) ? lead.receivedBy : null,
  }));
}

function clearMissingGuestAssignees(guests: Guest[], allowed: Set<string>): Guest[] {
  return guests.map((guest) => ({
    ...guest,
    assignedTo: guest.assignedTo && allowed.has(guest.assignedTo) ? guest.assignedTo : null,
  }));
}
