"use client";

import { Shield } from "lucide-react";

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
import { ADMIN_DISPLAY_NAME, isTeamAdmin } from "@/lib/team-admin";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  people: string[];
  current: string;
  showAdmin?: boolean;
  onPick: (name: string) => void;
  onOpenChange: (open: boolean) => void;
};

export function WhoAmI({
  open,
  people,
  current,
  showAdmin = false,
  onPick,
  onOpenChange,
}: Props) {
  const teammates = people.filter((person) => !isTeamAdmin(person));
  const adminSelected = isTeamAdmin(current);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92dvh,40rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl tracking-wide">
            Who are you?
          </DialogTitle>
          <DialogDescription>
            {showAdmin
              ? "Tap your name to update the board. Admin is at the top — use it only to add, edit, or remove teammates, not to claim calls."
              : "Tap your name to update the board."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {showAdmin ? (
            <button
              type="button"
              onClick={() => onPick(ADMIN_DISPLAY_NAME)}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border-2 px-3 py-3 text-left transition-colors",
                adminSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-primary bg-primary/12 text-foreground"
              )}
            >
              <span
                className={cn(
                  "grid size-12 shrink-0 place-items-center rounded-full",
                  adminSelected
                    ? "bg-primary-foreground/15 text-primary-foreground"
                    : "bg-primary text-primary-foreground"
                )}
              >
                <Shield className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-semibold leading-tight">Admin</span>
                <span
                  className={cn(
                    "mt-0.5 block text-sm leading-snug",
                    adminSelected ? "text-primary-foreground/85" : "text-muted-foreground"
                  )}
                >
                  Manage the roster — add, edit, or remove teammates
                </span>
              </span>
              {adminSelected ? (
                <span className="shrink-0 text-xs font-semibold uppercase tracking-wide">
                  Selected
                </span>
              ) : null}
            </button>
          ) : null}

          {teammates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {showAdmin
                ? "No teammates on the roster yet. Choose Admin, then open the Team tab to add people."
                : "No teammates on the roster yet."}
            </p>
          ) : (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Team
              </p>
              <div className="flex flex-wrap gap-2">
                {teammates.map((person) => (
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
            </div>
          )}
        </div>
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
