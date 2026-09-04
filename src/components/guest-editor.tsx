"use client";

import { useState } from "react";

import { PersonChip } from "@/components/person-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { uniquePeople } from "@/lib/people";
import { GUEST_STATUSES, type Guest, type GuestStatus, type Lead } from "@/lib/types";

type Props = {
  guest: Guest | null;
  guests: Guest[];
  leads: Lead[];
  me: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, patch: Partial<Guest> & { actor?: string }) => Promise<void>;
  busy?: boolean;
};

export function GuestEditor({
  guest,
  guests,
  leads,
  me,
  open,
  onOpenChange,
  onSave,
  busy,
}: Props) {
  if (!guest) return null;
  return (
    <GuestEditorForm
      key={guest.id}
      guest={guest}
      guests={guests}
      leads={leads}
      me={me}
      open={open}
      onOpenChange={onOpenChange}
      onSave={onSave}
      busy={busy}
    />
  );
}

function GuestEditorForm({
  guest,
  guests,
  leads,
  me,
  open,
  onOpenChange,
  onSave,
  busy,
}: Props & { guest: Guest }) {
  const [assignedTo, setAssignedTo] = useState(guest.assignedTo ?? "");
  const [status, setStatus] = useState<GuestStatus>(guest.status);
  const [partySize, setPartySize] = useState(String(guest.partySize));
  const [notes, setNotes] = useState(guest.notes);
  const people = uniquePeople(leads, guests);

  async function persist(next: {
    assignedTo?: string;
    status?: GuestStatus;
    partySize?: string;
    notes?: string;
  }) {
    const nextAssigned = next.assignedTo ?? assignedTo;
    const nextStatus = next.status ?? status;
    const nextSize = next.partySize ?? partySize;
    const nextNotes = next.notes ?? notes;
    setAssignedTo(nextAssigned);
    setStatus(nextStatus);
    setPartySize(nextSize);
    setNotes(nextNotes);
    await onSave(guest.id, {
      assignedTo: nextAssigned || null,
      status: nextStatus,
      partySize: Math.max(1, Number(nextSize) || 1),
      notes: nextNotes,
      actor: me || undefined,
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto px-4 pb-6">
        <SheetHeader className="pr-8 text-left">
          <SheetTitle className="font-heading text-2xl tracking-wide">{guest.name}</SheetTitle>
          <SheetDescription>
            Mark the invite, how many seats, and who is following up.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          <section className="space-y-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Status
            </p>
            <div className="grid grid-cols-2 gap-2">
              {GUEST_STATUSES.map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  variant={status === item.id ? "default" : "outline"}
                  className="h-12"
                  onClick={() => persist({ status: item.id })}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              How many seats
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="size-12"
                onClick={() => persist({ partySize: String(Math.max(1, (Number(partySize) || 1) - 1)) })}
              >
                −
              </Button>
              <Input
                value={partySize}
                onChange={(event) => setPartySize(event.target.value)}
                inputMode="numeric"
                className="h-12 text-center text-lg"
              />
              <Button
                type="button"
                variant="outline"
                className="size-12"
                onClick={() => persist({ partySize: String((Number(partySize) || 1) + 1) })}
              >
                +
              </Button>
              <Button type="button" variant="secondary" className="h-12 px-4" onClick={() => persist({})}>
                Save
              </Button>
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Who is on this
            </p>
            <div className="flex flex-wrap gap-2">
              {people.map((person) => (
                <Button
                  key={person}
                  type="button"
                  variant={assignedTo === person ? "default" : "outline"}
                  className="h-11 rounded-full px-3"
                  onClick={() => persist({ assignedTo: person })}
                >
                  <PersonChip name={person} />
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={assignedTo}
                onChange={(event) => setAssignedTo(event.target.value)}
                placeholder="Type a name"
                className="h-12 text-base"
              />
              <Button type="button" variant="secondary" className="h-12 px-4" onClick={() => persist({ assignedTo })}>
                Save
              </Button>
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Notes
            </p>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="How you reached them, tickets, kids, dietary…"
              className="min-h-24 text-base"
            />
            <Button type="button" variant="secondary" className="h-12 w-full" onClick={() => persist({ notes })}>
              Save note
            </Button>
          </section>
        </div>

        <SheetFooter className="mt-4">
          <Button
            type="button"
            className="h-14 w-full text-base"
            variant={status === "confirmed" ? "outline" : "default"}
            disabled={busy}
            onClick={() => persist({ status: status === "confirmed" ? "reached" : "confirmed" })}
          >
            {status === "confirmed" ? "Mark not confirmed" : "Confirm they’re coming"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
