"use client";

import { useState } from "react";
import { MessageSquare, Phone } from "lucide-react";

import { PersonChip } from "@/components/person-chip";
import { Button, buttonVariants } from "@/components/ui/button";
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
import {
  GUEST_STATUSES,
  displayGuestName,
  inviteSmsBody,
  smsHref,
  telHref,
  type Guest,
  type GuestStatus,
} from "@/lib/types";
import { DEFAULT_TICKET_URL } from "@/lib/tickets";
import { cn } from "@/lib/utils";

type Props = {
  guest: Guest | null;
  people: string[];
  me: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, patch: Partial<Guest> & { actor?: string }) => Promise<void>;
  busy?: boolean;
  ticketUrl?: string | null;
};

export function GuestEditor({
  guest,
  people,
  me,
  open,
  onOpenChange,
  onSave,
  busy,
  ticketUrl,
}: Props) {
  if (!guest) return null;
  return (
    <GuestEditorForm
      key={guest.id}
      guest={guest}
      people={people}
      me={me}
      open={open}
      onOpenChange={onOpenChange}
      onSave={onSave}
      busy={busy}
      ticketUrl={ticketUrl}
    />
  );
}

function GuestEditorForm({
  guest,
  people,
  me,
  open,
  onOpenChange,
  onSave,
  busy,
  ticketUrl,
}: Props & { guest: Guest }) {
  const [firstName, setFirstName] = useState(guest.firstName || "");
  const [lastName, setLastName] = useState(guest.lastName || "");
  const [phone, setPhone] = useState(guest.phone || "");
  const [email, setEmail] = useState(guest.email || "");
  const [assignedTo, setAssignedTo] = useState(guest.assignedTo ?? "");
  const [status, setStatus] = useState<GuestStatus>(guest.status);
  const [partySize, setPartySize] = useState(String(guest.partySize));
  const [notes, setNotes] = useState(guest.notes);
  const callHref = telHref(phone);
  const textHref = smsHref(phone, inviteSmsBody(ticketUrl ?? DEFAULT_TICKET_URL));

  async function persist(next: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    assignedTo?: string;
    status?: GuestStatus;
    partySize?: string;
    notes?: string;
  }) {
    const nextFirst = next.firstName ?? firstName;
    const nextLast = next.lastName ?? lastName;
    const nextPhone = next.phone ?? phone;
    const nextEmail = next.email ?? email;
    const nextAssigned = next.assignedTo ?? assignedTo;
    const nextStatus = next.status ?? status;
    const nextSize = next.partySize ?? partySize;
    const nextNotes = next.notes ?? notes;
    setFirstName(nextFirst);
    setLastName(nextLast);
    setPhone(nextPhone);
    setEmail(nextEmail);
    setAssignedTo(nextAssigned);
    setStatus(nextStatus);
    setPartySize(nextSize);
    setNotes(nextNotes);
    await onSave(guest.id, {
      firstName: nextFirst,
      lastName: nextLast,
      phone: nextPhone,
      email: nextEmail,
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
          <SheetTitle className="font-heading text-2xl tracking-wide">
            {displayGuestName({ firstName, lastName, name: guest.name })}
          </SheetTitle>
          <SheetDescription>
            Call or text them, set the response, how many members, and who on the team owns this.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {callHref && textHref ? (
            <div className="grid grid-cols-2 gap-2">
              <a
                href={callHref}
                className={cn(buttonVariants({ variant: "default" }), "h-14 gap-2 text-base")}
              >
                <Phone className="size-5" />
                Call
              </a>
              <a
                href={textHref}
                className={cn(buttonVariants({ variant: "secondary" }), "h-14 gap-2 text-base")}
              >
                <MessageSquare className="size-5" />
                Text
              </a>
            </div>
          ) : null}

          <section className="space-y-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Contact
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder="First name"
                className="h-12 text-base"
              />
              <Input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                placeholder="Last name"
                className="h-12 text-base"
              />
            </div>
            <Input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Phone number"
              inputMode="tel"
              className="h-12 text-base"
            />
            <Input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email (optional)"
              inputMode="email"
              className="h-12 text-base"
            />
            <Button
              type="button"
              variant="secondary"
              className="h-12 w-full"
              onClick={() => persist({ firstName, lastName, phone, email })}
            >
              Save contact
            </Button>
          </section>

          <section className="space-y-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Call response
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
              How many members
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="size-12"
                onClick={() =>
                  persist({ partySize: String(Math.max(1, (Number(partySize) || 1) - 1)) })
                }
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
              Team assignment
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
                placeholder="Type a team name"
                className="h-12 text-base"
              />
              <Button
                type="button"
                variant="secondary"
                className="h-12 px-4"
                onClick={() => persist({ assignedTo })}
              >
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
              placeholder="What they said, callback time, kids…"
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
            onClick={() =>
              persist({ status: status === "confirmed" ? "not_called" : "confirmed" })
            }
          >
            {status === "confirmed" ? "Clear confirmation" : "Mark confirmed"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
