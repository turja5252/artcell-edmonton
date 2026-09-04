import { promises as fs } from "fs";
import path from "path";

import { uniqueId } from "@/lib/ids";
import type { Lead, LeadPatch } from "@/lib/types";

const DATA_PATH = path.join(process.cwd(), "data", "leads.json");

let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function readFile(): Promise<Lead[]> {
  const raw = await fs.readFile(DATA_PATH, "utf8");
  const parsed = JSON.parse(raw) as Lead[];
  return parsed.map((lead) => ({
    ...lead,
    assignedTo: lead.assignedTo?.trim() || null,
    outcome: lead.outcome ?? "",
  }));
}

async function writeFile(leads: Lead[]) {
  await fs.writeFile(DATA_PATH, `${JSON.stringify(leads, null, 2)}\n`, "utf8");
}

function stamp(lead: Lead, actor?: string | null): Lead {
  return {
    ...lead,
    updatedAt: new Date().toISOString(),
    updatedBy: actor?.trim() || lead.updatedBy,
  };
}

export function listLeads(): Promise<Lead[]> {
  return enqueue(readFile);
}

export function createLead(input: {
  company: string;
  assignedTo?: string | null;
  actor?: string | null;
}): Promise<Lead> {
  return enqueue(async () => {
    const company = input.company.trim();
    if (!company) throw new Error("Company name is required");
    const leads = await readFile();
    const lead: Lead = stamp(
      {
        id: uniqueId(company, leads.map((item) => item.id)),
        company,
        assignedTo: input.assignedTo?.trim() || null,
        done: false,
        outcome: "",
        updatedAt: null,
        updatedBy: null,
      },
      input.actor
    );
    leads.push(lead);
    await writeFile(leads);
    return lead;
  });
}

export function patchLead(id: string, patch: LeadPatch): Promise<Lead> {
  return enqueue(async () => {
    const leads = await readFile();
    const index = leads.findIndex((lead) => lead.id === id);
    if (index === -1) throw new Error("Lead not found");
    const current = leads[index];
    const next = stamp(
      {
        ...current,
        company: patch.company?.trim() || current.company,
        assignedTo:
          patch.assignedTo === undefined
            ? current.assignedTo
            : patch.assignedTo?.trim() || null,
        done: patch.done ?? current.done,
        outcome: patch.outcome === undefined ? current.outcome : patch.outcome,
      },
      patch.actor
    );
    leads[index] = next;
    await writeFile(leads);
    return next;
  });
}

export function mergeSheetRows(
  rows: { company: string; assignedTo: string | null }[],
  actor?: string | null
): Promise<{ leads: Lead[]; added: number }> {
  return enqueue(async () => {
    const leads = await readFile();
    const existing = new Set(
      leads.map((lead) => lead.company.trim().toLowerCase())
    );
    let added = 0;
    for (const row of rows) {
      const company = row.company.trim();
      if (!company || existing.has(company.toLowerCase())) continue;
      leads.push(
        stamp(
          {
            id: uniqueId(
              company,
              leads.map((item) => item.id)
            ),
            company,
            assignedTo: row.assignedTo?.trim() || null,
            done: false,
            outcome: "",
            updatedAt: null,
            updatedBy: null,
          },
          actor
        )
      );
      existing.add(company.toLowerCase());
      added += 1;
    }
    await writeFile(leads);
    return { leads, added };
  });
}
