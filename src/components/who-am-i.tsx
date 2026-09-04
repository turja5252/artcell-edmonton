"use client";

import { Button } from "@/components/ui/button";
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl tracking-wide">
            Who are you?
          </DialogTitle>
          <DialogDescription>
            Pick your name from the team list. New teammates can only be added by Tanzim.
          </DialogDescription>
        </DialogHeader>
        {people.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No teammates on the roster yet. Ask Tanzim to add you on the Team tab.
          </p>
        ) : (
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
        )}
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
