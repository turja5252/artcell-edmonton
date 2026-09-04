"use client";

import { PersonChip } from "@/components/person-chip";
import { countableMoney, formatMoney } from "@/lib/money";
import { isLeadDeclined, leadGlowClass, type Lead } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  leads: Lead[];
  members: { name: string }[];
  target: number;
  onSetTarget: () => void;
  onOpenLead: (lead: Lead) => void;
};

export function MoneyBoard({ leads, members, target, onSetTarget, onOpenLead }: Props) {
  const committed = leads.reduce((sum, lead) => sum + countableMoney(lead).committed, 0);
  const received = leads.reduce((sum, lead) => sum + countableMoney(lead).received, 0);
  const remaining = Math.max(0, target - committed);
  const outstanding = Math.max(0, committed - received);
  const pledgedCount = leads.filter((lead) => countableMoney(lead).committed > 0).length;
  const percent = target > 0 ? Math.min(100, Math.round((committed / target) * 100)) : 0;

  const people = members
    .map((member) => {
      const mine = leads.filter((lead) => lead.assignedTo === member.name);
      return {
        name: member.name,
        committed: mine.reduce((sum, lead) => sum + countableMoney(lead).committed, 0),
        received: mine.reduce((sum, lead) => sum + countableMoney(lead).received, 0),
      };
    })
    .filter((row) => row.committed > 0 || row.received > 0)
    .sort((a, b) => b.committed - a.committed);

  const ranked = [...leads].sort(
    (a, b) => b.committed - a.committed || a.company.localeCompare(b.company)
  );

  return (
    <div className="space-y-4 pb-24">
      <p className="text-sm text-muted-foreground">
        Tap a company to log what they pledged. Everyone on this link sees the running total.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <HeroStat label="Committed" value={formatMoney(committed)} accent />
        <button type="button" onClick={onSetTarget} className="text-left">
          <HeroStat
            label={target ? "Target" : "Set a target"}
            value={target ? formatMoney(target) : "Tap"}
          />
        </button>
        <HeroStat
          label="Remaining"
          value={target ? formatMoney(remaining) : "—"}
        />
        <HeroStat label="Received" value={formatMoney(received)} />
      </div>

      <div className="rounded-2xl border border-border/80 bg-card/80 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {target ? `${percent}% of target` : "Set a target to track the gap"}
          </span>
          <span className="tabular-nums text-muted-foreground">
            {pledgedCount} pledged
          </span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${target ? percent : 0}%` }}
          />
        </div>
        {outstanding > 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {formatMoney(outstanding)} still to collect from pledges.
          </p>
        ) : null}
      </div>

      {people.some((row) => row.committed > 0) ? (
        <section>
          <h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            By person
          </h2>
          <ul className="space-y-2">
            {people
              .filter((row) => row.committed > 0)
              .map((row) => (
                <li
                  key={row.name}
                  className="flex items-center justify-between rounded-2xl border border-border/80 bg-card/70 px-3 py-3"
                >
                  <PersonChip name={row.name} />
                  <span className="text-sm tabular-nums">
                    {formatMoney(row.committed)}
                    {row.received > 0 ? (
                      <span className="ml-2 text-muted-foreground">
                        in {formatMoney(row.received)}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Companies
        </h2>
        <ul className="space-y-2">
          {ranked.map((lead) => {
            const declined = isLeadDeclined(lead);
            const money = countableMoney(lead);
            return (
            <li key={lead.id}>
              <button
                type="button"
                onClick={() => onOpenLead(lead)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card/80 p-3 text-left",
                  // Declined red wins (including $0 rows). Pledged/received glow green.
                  leadGlowClass(lead)
                )}
              >
                <span>
                  <span className="block font-medium">{lead.company}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-2">
                    {lead.assignedTo ? (
                      <PersonChip name={lead.assignedTo} />
                    ) : (
                      <span className="text-xs text-muted-foreground">Unassigned</span>
                    )}
                    {declined ? (
                      <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
                        Declined
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className="text-right">
                  {money.committed > 0 && !declined ? (
                    <span className="mb-0.5 block text-[10px] font-medium tracking-wide text-emerald-300/90 uppercase">
                      Pledged
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      "font-heading block text-xl tabular-nums",
                      money.committed > 0
                        ? declined
                          ? "text-foreground"
                          : "text-emerald-300"
                        : "text-muted-foreground"
                    )}
                  >
                    {money.committed > 0
                      ? formatMoney(money.committed)
                      : declined
                        ? formatMoney(0)
                        : "Add $"}
                  </span>
                  {money.received > 0 ? (
                    <span
                      className={cn(
                        "text-xs",
                        declined ? "text-muted-foreground" : "text-emerald-200/80"
                      )}
                    >
                      {lead.receivedBy
                        ? `${lead.receivedBy.split(" ")[0]} collected ${formatMoney(money.received)}`
                        : `Received ${formatMoney(money.received)}`}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function HeroStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card/80 px-3 py-3">
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p
        className={cn(
          "font-heading mt-1 text-2xl leading-none tabular-nums",
          accent && "text-primary"
        )}
      >
        {value}
      </p>
    </div>
  );
}
