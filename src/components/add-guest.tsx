"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export type AddGuestInput = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  assignedTo: string | null;
  partySize: number;
};

type Props = {
  open: boolean;
  me: string;
  people: string[];
  onOpenChange: (open: boolean) => void;
  onAdd: (input: AddGuestInput) => Promise<void>;
};

export function AddGuest({ open, me, people, onOpenChange, onAdd }: Props) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [assignedTo, setAssignedTo] = useState(me);
  const [partySize, setPartySize] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    const first = firstName.trim();
    const last = lastName.trim();
    if (!first && !last) {
      setError("Add a first or last name.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onAdd({
        firstName: first,
        lastName: last,
        phone: phone.trim(),
        email: email.trim(),
        assignedTo: assignedTo.trim() || null,
        partySize: Math.max(1, Number(partySize) || 1),
      });
      setFirstName("");
      setLastName("");
      setPhone("");
      setEmail("");
      setPartySize("1");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add this person");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="px-4 pb-6">
        <SheetHeader className="px-0 text-left">
          <SheetTitle className="font-heading text-2xl tracking-wide">
            Add someone to call
          </SheetTitle>
          <SheetDescription>
            First name, last name, phone, optional email, and who on the team owns the call.
          </SheetDescription>
        </SheetHeader>
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              placeholder="First name"
              className="h-12 text-base"
              autoFocus
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
          <Input
            value={assignedTo}
            onChange={(event) => setAssignedTo(event.target.value)}
            placeholder="Team assignment (optional)"
            className="h-12 text-base"
            list="guest-team-names"
          />
          <datalist id="guest-team-names">
            {people.map((person) => (
              <option key={person} value={person} />
            ))}
          </datalist>
          <Input
            value={partySize}
            onChange={(event) => setPartySize(event.target.value)}
            inputMode="numeric"
            placeholder="How many members"
            className="h-12 text-base"
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <SheetFooter className="px-0">
            <Button type="submit" className="h-14 w-full text-base" disabled={busy}>
              {busy ? "Adding…" : "Add to call list"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
