"use client";

import { PersonChip } from "@/components/person-chip";
import { Button } from "@/components/ui/button";
import { formatSeats } from "@/lib/money";
import { formatTime } from "@/lib/people";
import type { Guest, GuestStatus } from "@/lib/types";
import { GUEST_STATUSES } from "@/lib/types";
import { cn } from "@/lib/utils";

type Filter = "all" | "not_reached" | "reached" | "maybe" | "confirmed" | "mine";

type Props = {
  guests: Guest[];
  target: number;
  me: string;
  filter: Filter;
  onFilter: (filter: Filter) => void;
  onSetTarget: () => void;
  onOpen: (guest: Guest) => void;
  onClaim: (guest: Guest) => void;
  onStatus: (guest: Guest, status: GuestStatus) => void;
};

export function SeatsBoard({
  guests,
  target,
  me,
  filter,
  onFilter,
  onSetTarget,
  onOpen,
  onClaim,
  onStatus,
}: Props) {
  const seats = (status: GuestStatus) =>
    guests.filter((guest) => guest.status === status).reduce((sum, guest) => sum + guest.partySize, 0);

  const confirmed = seats("confirmed");
  const maybe = seats("maybe");
  const reached = seats("reached");
  const notReached = seats("not_reached");
  const remaining = target > 0 ? Math.max(0, target - confirmed) : 0;
  const percent = target > 0 ? Math.min(100, Math.round((confirmed / target) * 100)) : 0;

  const visible = guests
    .filter((guest) => {
      if (filter === "mine") return Boolean(me) && guest.assignedTo === me;
      if (filter === "all") return true;
      return guest.status === filter;
    })
    .sort((a, b) => statusRank(a.status) - statusRank(b.status) || a.name.localeCompare(b.name));

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "not_reached", label: "Not reached", count: guests.filter((g) => g.status === "not_reached").length },
    { id: "reached", label: "Reached", count: guests.filter((g) => g.status === "reached").length },
    { id: "maybe", label: "Maybe", count: guests.filter((g) => g.status === "maybe").length },
    { id: "confirmed", label: "In", count: guests.filter((g) => g.status === "confirmed").length },
    { id: "mine", label: me ? me.split(" ")[0] : "Mine", count: me ? guests.filter((g) => g.assignedTo === me).length : 0 },
    { id: "all", label: "All", count: guests.length },
  ];

  return (
    <div className="space-y-4 pb-24">
      <p className="text-sm text-muted-foreground">
        Invite list for filling the room. Tap a name, mark what they said, and the seat count updates.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <HeroStat label="Confirmed" value={formatSeats(confirmed)} accent />
        <button type="button" onClick={onSetTarget} className="text-left">
          <HeroStat
            label={target ? "Seat target" : "Set seat target"}
            value={target ? formatSeats(target) : "Tap"}
          />
        </button>
        <HeroStat label="Remaining" value={target ? formatSeats(remaining) : "—"} />
        <HeroStat label="Maybe" value={formatSeats(maybe)} />
      </div>

      <div className="rounded-2xl border border-border/80 bg-card/80 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {target ? `${percent}% of the room` : "Set a seat target for the venue"}
          </span>
          <span className="tabular-nums text-muted-foreground">
            {formatSeats(notReached + reached)} still in outreach
          </span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${target ? percent : 0}%` }}
          />
        </div>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {filters.map((item) => (
          <Button
            key={item.id}
            type="button"
            variant={filter === item.id ? "default" : "outline"}
            className="h-10 shrink-0 rounded-full px-3"
            onClick={() => onFilter(item.id)}
          >
            {item.label}
            <span className="tabular-nums opacity-80">{item.count}</span>
          </Button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center">
          <p className="font-medium">
            {guests.length === 0 ? "No one on the invite list yet" : "No matches in this filter"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap + to add a person, family, or group you still need to reach.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((guest) => (
            <li key={guest.id}>
              <article className="rounded-2xl border border-border/80 bg-card/80 p-3">
                <button type="button" onClick={() => onOpen(guest)} className="w-full text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg leading-tight font-semibold">{guest.name}</h2>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        {guest.assignedTo ? (
                          <PersonChip name={guest.assignedTo} />
                        ) : (
                          <span className="text-xs text-primary">Nobody claimed this yet</span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {guest.partySize} {guest.partySize === 1 ? "seat" : "seats"}
                        </span>
                        <StatusPill status={guest.status} />
                      </div>
                    </div>
                  </div>
                  {guest.notes ? (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{guest.notes}</p>
                  ) : null}
                  {guest.updatedAt ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Updated {formatTime(guest.updatedAt)}
                      {guest.updatedBy ? ` · ${guest.updatedBy}` : ""}
                    </p>
                  ) : null}
                </button>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {!guest.assignedTo ? (
                    <Button type="button" className="h-12" onClick={() => onClaim(guest)}>
                      I’ll take this
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" className="h-12" onClick={() => onOpen(guest)}>
                      Add note
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant={guest.status === "confirmed" ? "outline" : "secondary"}
                    className="h-12"
                    onClick={() =>
                      onStatus(guest, guest.status === "confirmed" ? "reached" : "confirmed")
                    }
                  >
                    {guest.status === "confirmed" ? "Undo confirm" : "They’re in"}
                  </Button>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function statusRank(status: GuestStatus): number {
  return GUEST_STATUSES.findIndex((item) => item.id === status);
}

function StatusPill({ status }: { status: GuestStatus }) {
  const label = GUEST_STATUSES.find((item) => item.id === status)?.label ?? status;
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs",
        status === "confirmed" && "bg-emerald-500/15 text-emerald-300",
        status === "maybe" && "bg-primary/15 text-primary",
        status === "declined" && "bg-destructive/15 text-destructive",
        status === "reached" && "bg-sky-500/15 text-sky-300",
        status === "not_reached" && "bg-muted text-muted-foreground"
      )}
    >
      {label}
    </span>
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
