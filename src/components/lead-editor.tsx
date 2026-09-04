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
import { LeadAttachments } from "@/components/lead-attachments";
import { formatMoney, parseMoney } from "@/lib/money";
import { isTeamAdmin } from "@/lib/team-admin";
import { MONEY_CHIPS, OUTCOME_CHIPS, type Lead } from "@/lib/types";

function defaultCollector(assignedTo: string, me: string): string {
  const assigned = assignedTo.trim();
  if (assigned) return assigned;
  const actor = me.trim();
  if (actor && !isTeamAdmin(actor)) return actor;
  return "";
}

type Props = {
  lead: Lead | null;
  people: string[];
  me: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, patch: Partial<Lead> & { actor?: string }) => Promise<void>;
  onLeadChange?: (lead: Lead) => void;
  onDelete?: (id: string) => Promise<void>;
  busy?: boolean;
};

export function LeadEditor({
  lead,
  people,
  me,
  open,
  onOpenChange,
  onSave,
  onLeadChange,
  onDelete,
  busy,
}: Props) {
  if (!lead) return null;

  return (
    <LeadEditorForm
      key={lead.id}
      lead={lead}
      people={people}
      me={me}
      open={open}
      onOpenChange={onOpenChange}
      onSave={onSave}
      onLeadChange={onLeadChange}
      onDelete={onDelete}
      busy={busy}
    />
  );
}

function LeadEditorForm({
  lead,
  people,
  me,
  open,
  onOpenChange,
  onSave,
  onLeadChange,
  onDelete,
  busy,
}: Props & { lead: Lead }) {
  const [company, setCompany] = useState(lead.company);
  const [outcome, setOutcome] = useState(lead.outcome);
  const [assignedTo, setAssignedTo] = useState(lead.assignedTo ?? "");
  const [done, setDone] = useState(lead.done);
  const [committed, setCommitted] = useState(lead.committed ? String(lead.committed) : "");
  const [received, setReceived] = useState(lead.received ? String(lead.received) : "");
  const [receivedBy, setReceivedBy] = useState(() => {
    if (lead.receivedBy) return lead.receivedBy;
    if (lead.received > 0) return defaultCollector(lead.assignedTo ?? "", me);
    return "";
  });
  const [receivedByTouched, setReceivedByTouched] = useState(Boolean(lead.receivedBy));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const leadId = lead.id;

  async function persist(next: {
    company?: string;
    outcome?: string;
    assignedTo?: string;
    done?: boolean;
    committed?: string;
    received?: string;
    receivedBy?: string;
  }) {
    const nextCompany = (next.company ?? company).trim() || lead.company;
    const nextOutcome = next.outcome ?? outcome;
    const nextAssigned = next.assignedTo ?? assignedTo;
    const nextDone = next.done ?? done;
    const nextCommitted = next.committed ?? committed;
    const nextReceived = next.received ?? received;
    let nextReceivedBy = next.receivedBy ?? receivedBy;
    const parsedReceived = parseMoney(nextReceived);
    if (parsedReceived > 0) {
      if (!receivedByTouched) {
        nextReceivedBy = defaultCollector(nextAssigned, me);
      } else {
        nextReceivedBy = nextReceivedBy.trim() || defaultCollector(nextAssigned, me);
      }
    } else if (next.received !== undefined) {
      nextReceivedBy = "";
    }
    setCompany(nextCompany);
    setOutcome(nextOutcome);
    setAssignedTo(nextAssigned);
    setDone(nextDone);
    setCommitted(nextCommitted);
    setReceived(nextReceived);
    setReceivedBy(nextReceivedBy);
    await onSave(leadId, {
      company: nextCompany,
      outcome: nextOutcome,
      assignedTo: nextAssigned || null,
      done: nextDone,
      committed: parseMoney(nextCommitted),
      received: parsedReceived,
      receivedBy: parsedReceived > 0 ? nextReceivedBy || null : null,
      actor: me || undefined,
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto px-4 pb-6">
        <SheetHeader className="pr-8 text-left">
          <SheetTitle className="font-heading text-2xl tracking-wide">
            {company || lead.company}
          </SheetTitle>
          <SheetDescription>
            Tap a result, claim it, or mark it done. Everyone on this link sees the update.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          <section className="space-y-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Entry name
            </p>
            <div className="flex gap-2">
              <Input
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                placeholder="Company or person"
                className="h-12 text-base"
              />
              <Button
                type="button"
                variant="secondary"
                className="h-12 px-4"
                onClick={() => persist({ company })}
              >
                Save
              </Button>
            </div>
          </section>

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
              {me && !people.includes(me) && !isTeamAdmin(me) && (
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
                  onChange={(event) => {
                    const value = event.target.value;
                    setReceived(value);
                    if (parseMoney(value) > 0 && !receivedByTouched) {
                      setReceivedBy(defaultCollector(assignedTo, me));
                    }
                    if (parseMoney(value) === 0 && !lead.receivedBy && !receivedByTouched) {
                      setReceivedBy("");
                    }
                  }}
                  inputMode="decimal"
                  placeholder="0"
                  className="h-12 text-base"
                />
              </label>
            </div>
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">
                Who received the money — starts as whoever is on this
              </p>
              <div className="flex flex-wrap gap-2">
                {people
                  .filter((person) => !isTeamAdmin(person))
                  .map((person) => (
                    <Button
                      key={`recv-${person}`}
                      type="button"
                      variant={receivedBy === person ? "default" : "outline"}
                      className="h-10 rounded-full px-3"
                      onClick={() => {
                        setReceivedByTouched(true);
                        void persist({ receivedBy: person });
                      }}
                    >
                      <PersonChip name={person} />
                    </Button>
                  ))}
              </div>
              <Input
                value={receivedBy}
                onChange={(event) => {
                  setReceivedByTouched(true);
                  setReceivedBy(event.target.value);
                }}
                placeholder="Whoever is on this, unless you change it"
                className="h-12 text-base"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              className="h-12 w-full"
              onClick={() => persist({ committed, received, receivedBy })}
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

          <LeadAttachments
            lead={lead}
            me={me}
            onLeadChange={(next) => onLeadChange?.(next)}
          />
        </div>

        <SheetFooter className="mt-4 gap-2 sm:flex-col">
          <Button
            type="button"
            className="h-14 w-full text-base"
            variant={done ? "outline" : "default"}
            disabled={busy || deleting}
            onClick={() => persist({ done: !done })}
          >
            {done ? "Mark still open" : "Mark done"}
          </Button>
          {onDelete ? (
            confirmDelete ? (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12"
                  disabled={deleting}
                  onClick={() => setConfirmDelete(false)}
                >
                  Keep it
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="h-12"
                  disabled={deleting}
                  onClick={() => {
                    setDeleting(true);
                    void onDelete(leadId)
                      .then(() => onOpenChange(false))
                      .finally(() => {
                        setDeleting(false);
                        setConfirmDelete(false);
                      });
                  }}
                >
                  {deleting ? "Deleting…" : "Yes, delete"}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                className="h-12 w-full text-destructive"
                disabled={busy || deleting}
                onClick={() => setConfirmDelete(true)}
              >
                Delete this entry
              </Button>
            )
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
