"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PersonChip } from "@/components/person-chip";

type Props = {
  open: boolean;
  people: string[];
  current: string;
  onPick: (name: string) => void;
  onAddAndPick?: (name: string) => Promise<void>;
  onOpenChange: (open: boolean) => void;
};

export function WhoAmI({
  open,
  people,
  current,
  onPick,
  onAddAndPick,
  onOpenChange,
}: Props) {
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitCustom() {
    const name = custom.trim();
    if (!name) return;
    setBusy(true);
    try {
      if (onAddAndPick) await onAddAndPick(name);
      else onPick(name);
      setCustom("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl tracking-wide">
            Who are you?
          </DialogTitle>
          <DialogDescription>
            Pick your name from the team, or type it to join the roster. No login.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {people.map((person) => (
            <Button
              key={person}
              type="button"
              variant={current === person ? "default" : "outline"}
              className="h-11 rounded-full px-3"
              onClick={() => onPick(person)}
            >
              <PersonChip name={person} />
            </Button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submitCustom();
          }}
        >
          <Input
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            placeholder="My name is…"
            className="h-12 text-base"
            autoComplete="name"
          />
          <Button type="submit" className="h-12 px-4" disabled={busy}>
            {busy ? "…" : "That’s me"}
          </Button>
        </form>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            className="h-11"
            onClick={() => onOpenChange(false)}
          >
            Skip for now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
