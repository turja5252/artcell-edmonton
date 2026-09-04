"use client";

import { PersonChip } from "@/components/person-chip";
import type { Lead } from "@/lib/types";
import { uniquePeople } from "@/lib/people";

type Props = {
  leads: Lead[];
  onFilterPerson: (name: string) => void;
};

export function TeamBoard({ leads, onFilterPerson }: Props) {
  const people = uniquePeople(leads);
  const openUnassigned = leads.filter((lead) => !lead.assignedTo && !lead.done);

  const rows = people
    .map((name) => {
      const mine = leads.filter((lead) => lead.assignedTo === name);
      const done = mine.filter((lead) => lead.done).length;
      return { name, total: mine.length, done };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  return (
    <div className="space-y-3 pb-24">
      <p className="text-sm text-muted-foreground">
        Tap a person to jump to their outreach list.
      </p>
      {openUnassigned.length > 0 && (
        <button
          type="button"
          onClick={() => onFilterPerson("")}
          className="w-full rounded-2xl border border-dashed border-primary/40 bg-primary/8 p-4 text-left"
        >
          <p className="font-medium text-primary">
            {openUnassigned.length} still need an owner
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {openUnassigned.map((lead) => lead.company).join(" · ")}
          </p>
        </button>
      )}
      <ul className="space-y-2">
        {rows.map((row) => {
          const percent = row.total === 0 ? 0 : Math.round((row.done / row.total) * 100);
          return (
            <li key={row.name}>
              <button
                type="button"
                onClick={() => onFilterPerson(row.name)}
                className="w-full rounded-2xl border border-border/80 bg-card/80 p-4 text-left shadow-sm backdrop-blur-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <PersonChip name={row.name} />
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {row.done}/{row.total}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
