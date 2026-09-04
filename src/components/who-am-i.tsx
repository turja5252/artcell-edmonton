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
  onOpenChange: (open: boolean) => void;
};

export function WhoAmI({ open, people, current, onPick, onOpenChange }: Props) {
  const [custom, setCustom] = useState("");

  function submitCustom() {
    const name = custom.trim();
    if (!name) return;
    onPick(name);
    setCustom("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl tracking-wide">
            Who are you?
          </DialogTitle>
          <DialogDescription>
            We use this to show your list first and stamp your updates. No login.
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
            submitCustom();
          }}
        >
          <Input
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            placeholder="My name is…"
            className="h-12 text-base"
            autoComplete="name"
          />
          <Button type="submit" className="h-12 px-4">
            That’s me
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
