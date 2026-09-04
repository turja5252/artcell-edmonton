"use client";

import { Phone } from "lucide-react";

import { PersonChip } from "@/components/person-chip";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatSeats } from "@/lib/money";
import { formatTime } from "@/lib/people";
import type { Guest, GuestStatus } from "@/lib/types";
import { GUEST_STATUSES, displayGuestName, telHref } from "@/lib/types";
import { cn } from "@/lib/utils";

export type SeatFilter = "all" | "not_called" | "confirmed" | "tentative" | "declined" | "mine";

type Props = {
  guests: Guest[];
  target: number;
  me: string;
  filter: SeatFilter;
  onFilter: (filter: SeatFilter) => void;
  onSetTarget: () => void;
  onOpen: (guest: Guest) => void;
  onClaim: (guest: Guest) => void;
  onStatus: (guest: Guest, status: GuestStatus) => void;
  onPartySize: (guest: Guest, partySize: number) => void;
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
  onPartySize,
}: Props) {
  const seats = (status: GuestStatus) =>
    guests.filter((guest) => guest.status === status).reduce((sum, guest) => sum + guest.partySize, 0);

  const confirmed = seats("confirmed");
  const tentative = seats("tentative");
  const notCalled = guests.filter((guest) => guest.status === "not_called").length;
  const remaining = target > 0 ? Math.max(0, target - confirmed) : 0;
  const percent = target > 0 ? Math.min(100, Math.round((confirmed / target) * 100)) : 0;

  const visible = guests
    .filter((guest) => {
      if (filter === "mine") return Boolean(me) && guest.assignedTo === me;
      if (filter === "all") return true;
      return guest.status === filter;
    })
    .sort(
      (a, b) =>
        statusRank(a.status) - statusRank(b.status) ||
        displayGuestName(a).localeCompare(displayGuestName(b))
    );

  const filters: { id: SeatFilter; label: string; count: number }[] = [
    {
      id: "not_called",
      label: "Not called",
      count: guests.filter((g) => g.status === "not_called").length,
    },
    {
      id: "confirmed",
      label: "Confirmed",
      count: guests.filter((g) => g.status === "confirmed").length,
    },
    {
      id: "tentative",
      label: "Tentative",
      count: guests.filter((g) => g.status === "tentative").length,
    },
    {
      id: "declined",
      label: "Declined",
      count: guests.filter((g) => g.status === "declined").length,
    },
    {
      id: "mine",
      label: me ? me.split(" ")[0] : "Mine",
      count: me ? guests.filter((g) => g.assignedTo === me).length : 0,
    },
    { id: "all", label: "All", count: guests.length },
  ];

  return (
    <div className="space-y-4 pb-24">
      <p className="text-sm text-muted-foreground">
        Call the list, log confirmed / tentative / declined, and how many people are coming.
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
        <HeroStat label="Tentative" value={formatSeats(tentative)} />
      </div>

      <div className="rounded-2xl border border-border/80 bg-card/80 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {target ? `${percent}% of the room` : "Set a seat target for the venue"}
          </span>
          <span className="tabular-nums text-muted-foreground">
            {notCalled} still to call
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
            {guests.length === 0 ? "No one on the call list yet" : "No matches in this filter"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap + to add a person with name, phone, and email.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((guest) => {
            const callHref = telHref(guest.phone);
            return (
              <li key={guest.id}>
                <article className="rounded-2xl border border-border/80 bg-card/80 p-3">
                  <button type="button" onClick={() => onOpen(guest)} className="w-full text-left">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-lg leading-tight font-semibold">
                          {displayGuestName(guest)}
                        </h2>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          {guest.assignedTo ? (
                            <PersonChip name={guest.assignedTo} />
                          ) : (
                            <span className="text-xs text-primary">Unassigned</span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {guest.partySize}{" "}
                            {guest.partySize === 1 ? "member" : "members"}
                          </span>
                          <StatusPill status={guest.status} />
                        </div>
                        {guest.phone ? (
                          <p className="mt-1 text-sm text-muted-foreground">{guest.phone}</p>
                        ) : (
                          <p className="mt-1 text-sm text-muted-foreground">No phone on file</p>
                        )}
                        {guest.email ? (
                          <p className="text-sm text-muted-foreground">{guest.email}</p>
                        ) : null}
                      </div>
                    </div>
                    {guest.notes ? (
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {guest.notes}
                      </p>
                    ) : null}
                    {guest.updatedAt ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Updated {formatTime(guest.updatedAt)}
                        {guest.updatedBy ? ` · ${guest.updatedBy}` : ""}
                      </p>
                    ) : null}
                  </button>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {callHref ? (
                      <a
                        href={callHref}
                        className={cn(buttonVariants({ variant: "default" }), "h-12 gap-2")}
                      >
                        <Phone className="size-4" />
                        Call
                      </a>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12"
                        onClick={() => onOpen(guest)}
                      >
                        Add phone
                      </Button>
                    )}
                    {!guest.assignedTo ? (
                      <Button type="button" variant="secondary" className="h-12" onClick={() => onClaim(guest)}>
                        Assign me
                      </Button>
                    ) : (
                      <Button type="button" variant="outline" className="h-12" onClick={() => onOpen(guest)}>
                        Update
                      </Button>
                    )}
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      variant={guest.status === "confirmed" ? "default" : "outline"}
                      className="h-11 text-xs sm:text-sm"
                      onClick={() => onStatus(guest, "confirmed")}
                    >
                      Confirmed
                    </Button>
                    <Button
                      type="button"
                      variant={guest.status === "tentative" ? "default" : "outline"}
                      className="h-11 text-xs sm:text-sm"
                      onClick={() => onStatus(guest, "tentative")}
                    >
                      Tentative
                    </Button>
                    <Button
                      type="button"
                      variant={guest.status === "declined" ? "default" : "outline"}
                      className="h-11 text-xs sm:text-sm"
                      onClick={() => onStatus(guest, "declined")}
                    >
                      Declined
                    </Button>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground shrink-0">Members</span>
                    <Button
                      type="button"
                      variant="outline"
                      className="size-10"
                      onClick={() => onPartySize(guest, Math.max(1, guest.partySize - 1))}
                    >
                      −
                    </Button>
                    <span className="min-w-8 text-center text-base tabular-nums font-medium">
                      {guest.partySize}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      className="size-10"
                      onClick={() => onPartySize(guest, guest.partySize + 1)}
                    >
                      +
                    </Button>
                  </div>
                </article>
              </li>
            );
          })}
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
        status === "tentative" && "bg-amber-500/15 text-amber-300",
        status === "declined" && "bg-destructive/15 text-destructive",
        status === "not_called" && "bg-muted text-muted-foreground"
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
