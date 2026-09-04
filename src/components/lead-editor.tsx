"use client";

import { useState } from "react";

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
import { PersonChip } from "@/components/person-chip";
import { formatMoney, parseMoney } from "@/lib/money";
import { uniquePeople } from "@/lib/people";
import { MONEY_CHIPS, OUTCOME_CHIPS, type Lead } from "@/lib/types";

type Props = {
  lead: Lead | null;
  leads: Lead[];
  me: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, patch: Partial<Lead> & { actor?: string }) => Promise<void>;
  busy?: boolean;
};

export function LeadEditor({
  lead,
  leads,
  me,
  open,
  onOpenChange,
  onSave,
  busy,
}: Props) {
  if (!lead) return null;

  return (
    <LeadEditorForm
      key={lead.id}
      lead={lead}
      leads={leads}
      me={me}
      open={open}
      onOpenChange={onOpenChange}
      onSave={onSave}
      busy={busy}
    />
  );
}

function LeadEditorForm({
  lead,
  leads,
  me,
  open,
  onOpenChange,
  onSave,
  busy,
}: Props & { lead: Lead }) {
  const [outcome, setOutcome] = useState(lead.outcome);
  const [assignedTo, setAssignedTo] = useState(lead.assignedTo ?? "");
  const [done, setDone] = useState(lead.done);
  const [committed, setCommitted] = useState(lead.committed ? String(lead.committed) : "");
  const [received, setReceived] = useState(lead.received ? String(lead.received) : "");
  const leadId = lead.id;
  const people = uniquePeople(leads);

  async function persist(next: {
    outcome?: string;
    assignedTo?: string;
    done?: boolean;
    committed?: string;
    received?: string;
  }) {
    const nextOutcome = next.outcome ?? outcome;
    const nextAssigned = next.assignedTo ?? assignedTo;
    const nextDone = next.done ?? done;
    const nextCommitted = next.committed ?? committed;
    const nextReceived = next.received ?? received;
    setOutcome(nextOutcome);
    setAssignedTo(nextAssigned);
    setDone(nextDone);
    setCommitted(nextCommitted);
    setReceived(nextReceived);
    await onSave(leadId, {
      outcome: nextOutcome,
      assignedTo: nextAssigned || null,
      done: nextDone,
      committed: parseMoney(nextCommitted),
      received: parseMoney(nextReceived),
      actor: me || undefined,
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto px-4 pb-6">
        <SheetHeader className="pr-8 text-left">
          <SheetTitle className="font-heading text-2xl tracking-wide">
            {lead.company}
          </SheetTitle>
          <SheetDescription>
            Tap a result, claim it, or mark it done. Everyone on this link sees the update.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-5">
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
              {me && !people.includes(me) && (
                <Button
                  type="button"
                  variant={assignedTo === me ? "default" : "outline"}
                  className="h-11 rounded-full px-3"
                  onClick={() => persist({ assignedTo: me })}
                >
                  {me}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={assignedTo}
                onChange={(event) => setAssignedTo(event.target.value)}
                placeholder="Type a name"
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
              How much they committed
            </p>
            <div className="grid grid-cols-3 gap-2">
              {MONEY_CHIPS.map((amount) => (
                <Button
                  key={amount}
                  type="button"
                  variant={parseMoney(committed) === amount ? "default" : "outline"}
                  className="h-12"
                  onClick={() => persist({ committed: String(amount) })}
                >
                  {formatMoney(amount)}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-[11px] text-muted-foreground">Committed</span>
                <Input
                  value={committed}
                  onChange={(event) => setCommitted(event.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                  className="h-12 text-base"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-muted-foreground">Received</span>
                <Input
                  value={received}
                  onChange={(event) => setReceived(event.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                  className="h-12 text-base"
                />
              </label>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="h-12 w-full"
              onClick={() => persist({ committed, received })}
            >
              Save money
            </Button>
          </section>

          <section className="space-y-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              What happened
            </p>
            <div className="grid grid-cols-2 gap-2">
              {OUTCOME_CHIPS.map((chip) => (
                <Button
                  key={chip}
                  type="button"
                  variant={outcome === chip ? "default" : "outline"}
                  className="h-12 whitespace-normal px-3 text-sm leading-tight"
                  onClick={() => persist({ outcome: chip })}
                >
                  {chip}
                </Button>
              ))}
            </div>
            <Textarea
              value={outcome}
              onChange={(event) => setOutcome(event.target.value)}
              placeholder="Or type a note — amount, contact, follow-up…"
              className="min-h-24 text-base"
            />
            <Button
              type="button"
              variant="secondary"
              className="h-12 w-full"
              onClick={() => persist({ outcome })}
            >
              Save note
            </Button>
          </section>
        </div>

        <SheetFooter className="mt-4 gap-2 sm:flex-col">
          <Button
            type="button"
            className="h-14 w-full text-base"
            variant={done ? "outline" : "default"}
            disabled={busy}
            onClick={() => persist({ done: !done })}
          >
            {done ? "Mark still open" : "Mark done"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
