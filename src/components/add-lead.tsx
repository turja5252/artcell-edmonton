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
  onAdd: (company: string, assignedTo: string | null) => Promise<void>;
};

export function AddLead({ open, me, people, onOpenChange, onAdd }: Props) {
  const [company, setCompany] = useState("");
  const [assignedTo, setAssignedTo] = useState(me);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    const name = company.trim();
    if (!name) {
      setError("Add the company or person to reach.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onAdd(name, assignedTo.trim() || null);
      setCompany("");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add this lead");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="px-4 pb-6">
        <SheetHeader className="px-0 text-left">
          <SheetTitle className="font-heading text-2xl tracking-wide">
            Add someone to reach
          </SheetTitle>
          <SheetDescription>
            New sponsor, vendor, or contact. It shows up for the whole team.
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
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            placeholder="Company or person"
            className="h-12 text-base"
            autoFocus
          />
          <Input
            value={assignedTo}
            onChange={(event) => setAssignedTo(event.target.value)}
            placeholder="Assigned to (optional)"
            className="h-12 text-base"
            list="team-names"
          />
          <datalist id="team-names">
            {people.map((person) => (
              <option key={person} value={person} />
            ))}
          </datalist>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <SheetFooter className="px-0">
            <Button type="submit" className="h-14 w-full text-base" disabled={busy}>
              {busy ? "Adding…" : "Add to the board"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
