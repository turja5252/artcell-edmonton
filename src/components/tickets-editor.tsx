"use client";

import { useEffect, useState } from "react";

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
  ticketsSold: number;
  updatedAt: string | null;
  me: string;
  onOpenChange: (open: boolean) => void;
  onSave: (input: {
    ticketsSold: number;
    ticketsSoldUpdatedAt: string;
    ticketsSoldUpdatedBy: string | null;
  }) => Promise<void>;
};

function toDateInput(value: string | null): string {
  if (!value) return todayInput();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return todayInput();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayInput(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateInputToIso(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return new Date().toISOString();
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
  return date.toISOString();
}

export function TicketsEditor({
  open,
  ticketsSold,
  updatedAt,
  me,
  onOpenChange,
  onSave,
}: Props) {
  const [count, setCount] = useState(ticketsSold ? String(ticketsSold) : "0");
  const [day, setDay] = useState(toDateInput(updatedAt));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setCount(String(ticketsSold || 0));
    setDay(toDateInput(updatedAt));
    setError("");
  }, [open, ticketsSold, updatedAt]);

  async function submit() {
    const nextCount = Math.max(0, Math.floor(Number(count.replace(/[^0-9]/g, "")) || 0));
    if (!day) {
      setError("Pick the day this count is for.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave({
        ticketsSold: nextCount,
        ticketsSoldUpdatedAt: dateInputToIso(day),
        ticketsSoldUpdatedBy: me || null,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save tickets");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="px-4 pb-6">
        <SheetHeader className="px-0 text-left">
          <SheetTitle className="font-heading text-2xl tracking-wide">
            Tickets sold
          </SheetTitle>
          <SheetDescription>
            Enter the latest ticket count and which day that number is from.
          </SheetDescription>
        </SheetHeader>
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label className="block text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Tickets sold
            <Input
              value={count}
              onChange={(event) => setCount(event.target.value)}
              inputMode="numeric"
              className="mt-1 h-12 text-base"
              autoFocus
            />
          </label>
          <label className="block text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Count as of this day
            <Input
              type="date"
              value={day}
              onChange={(event) => setDay(event.target.value)}
              className="mt-1 h-12 text-base"
            />
          </label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1"
              onClick={() => setDay(todayInput())}
            >
              Today
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1"
              onClick={() =>
                setCount(String(Math.max(0, (Number(count) || 0) + 1)))
              }
            >
              +1 ticket
            </Button>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <SheetFooter className="px-0">
            <Button type="submit" className="h-14 w-full text-base" disabled={busy}>
              {busy ? "Saving…" : "Save ticket count"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function formatTicketDay(value: string | null): string {
  if (!value) return "Not updated yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not updated yet";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
