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

type Props = {
  open: boolean;
  me: string;
  people: string[];
  onOpenChange: (open: boolean) => void;
  onAdd: (name: string, assignedTo: string | null, partySize: number) => Promise<void>;
};

export function AddGuest({ open, me, people, onOpenChange, onAdd }: Props) {
  const [name, setName] = useState("");
  const [assignedTo, setAssignedTo] = useState(me);
  const [partySize, setPartySize] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Add the person, family, or group.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onAdd(trimmed, assignedTo.trim() || null, Math.max(1, Number(partySize) || 1));
      setName("");
      setPartySize("1");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add this invite");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="px-4 pb-6">
        <SheetHeader className="px-0 text-left">
          <SheetTitle className="font-heading text-2xl tracking-wide">
            Add someone to invite
          </SheetTitle>
          <SheetDescription>
            Friends, family, workplace groups — whoever still needs a text or call.
          </SheetDescription>
        </SheetHeader>
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name or group"
            className="h-12 text-base"
            autoFocus
          />
          <Input
            value={assignedTo}
            onChange={(event) => setAssignedTo(event.target.value)}
            placeholder="Assigned to (optional)"
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
            placeholder="How many seats"
            className="h-12 text-base"
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <SheetFooter className="px-0">
            <Button type="submit" className="h-14 w-full text-base" disabled={busy}>
              {busy ? "Adding…" : "Add to invite list"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
