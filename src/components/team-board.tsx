"use client";

import { useState } from "react";
import { Pencil, Phone, Plus, Trash2 } from "lucide-react";

import { PersonChip } from "@/components/person-chip";
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
import type { Guest, Lead, Member } from "@/lib/types";
import { samePerson } from "@/lib/team-admin";

type Props = {
  members: Member[];
  leads: Lead[];
  guests: Guest[];
  canManage: boolean;
  onFilterPerson: (name: string) => void;
  onAdd: (input: { name: string; phone?: string; email?: string }) => Promise<void>;
  onSave: (
    id: string,
    input: { name: string; phone?: string; email?: string }
  ) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
};

export function TeamBoard({
  members,
  leads,
  guests,
  canManage,
  onFilterPerson,
  onAdd,
  onSave,
  onRemove,
}: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);

  const openUnassigned = leads.filter((lead) => !lead.assignedTo && !lead.done);

  const rows = members
    .map((member) => {
      const mine = leads.filter((lead) => samePerson(lead.assignedTo, member.name));
      const invites = guests.filter((guest) => samePerson(guest.assignedTo, member.name));
      const done = mine.filter((lead) => lead.done).length;
      const received = leads
        .filter((lead) => samePerson(lead.receivedBy, member.name))
        .reduce((sum, lead) => sum + lead.received, 0);
      return {
        member,
        total: mine.length,
        done,
        invites: invites.length,
        received,
      };
    })
    .sort((a, b) => b.total - a.total || a.member.name.localeCompare(b.member.name));

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Add their name.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onAdd({ name: trimmed, phone: phone.trim(), email: email.trim() });
      setName("");
      setPhone("");
      setEmail("");
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add member");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 pb-24">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {canManage
            ? "You’re Admin. Add organizers or tap Edit on anyone to change name, phone, or email."
            : "Team roster."}
        </p>
        {canManage ? (
          <Button
            type="button"
            className="h-11 shrink-0"
            onClick={() => setAdding((value) => !value)}
          >
            <Plus className="size-4" />
            Add
          </Button>
        ) : null}
      </div>

      {canManage && adding ? (
        <form
          className="space-y-2 rounded-2xl border border-border/80 bg-card/80 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name"
            className="h-12 text-base"
            autoFocus
          />
          <Input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Phone (optional)"
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
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="h-12 w-full" disabled={busy}>
            {busy ? "Adding…" : "Add to the team"}
          </Button>
        </form>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      {openUnassigned.length > 0 && (
        <button
          type="button"
          onClick={() => onFilterPerson("")}
          className="w-full rounded-2xl border border-dashed border-primary/40 bg-primary/8 p-4 text-left"
        >
          <p className="font-medium text-primary">
            {openUnassigned.length} sponsors still need an owner
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {openUnassigned.map((lead) => lead.company).join(" · ")}
          </p>
        </button>
      )}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center">
          <p className="font-medium">No members yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap Add and put organizers on the roster.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => {
            const percent =
              row.total === 0 ? 0 : Math.round((row.done / row.total) * 100);
            return (
              <li key={row.member.id}>
                <div className="rounded-2xl border border-border/80 bg-card/80 p-4 shadow-sm backdrop-blur-sm">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (canManage) setEditing(row.member);
                        else onFilterPerson(row.member.name);
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <PersonChip name={row.member.name} />
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          Sponsors {row.done}/{row.total}
                        </span>
                        <span>Invites {row.invites}</span>
                        {row.received > 0 ? (
                          <span>
                            Collected $
                            {row.received.toLocaleString("en-CA", {
                              maximumFractionDigits: 0,
                            })}
                          </span>
                        ) : null}
                      </div>
                      {row.member.phone ? (
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="size-3" />
                          {row.member.phone}
                        </p>
                      ) : null}
                      {row.member.email ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">{row.member.email}</p>
                      ) : null}
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </button>
                    <div className="flex shrink-0 flex-col gap-1">
                      {canManage ? (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-10 text-muted-foreground"
                            aria-label={`Edit ${row.member.name}`}
                            onClick={() => setEditing(row.member)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-10 text-muted-foreground"
                            aria-label={`Remove ${row.member.name}`}
                            onClick={() => {
                              void onRemove(row.member.id).catch((err) => {
                                setError(
                                  err instanceof Error
                                    ? err.message
                                    : "Could not remove teammate"
                                );
                              });
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <MemberEditor
        member={editing}
        open={Boolean(editing) && canManage}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onSave={onSave}
        onShowCalls={(name) => {
          setEditing(null);
          onFilterPerson(name);
        }}
      />
    </div>
  );
}

function MemberEditor({
  member,
  open,
  onOpenChange,
  onSave,
  onShowCalls,
}: {
  member: Member | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (
    id: string,
    input: { name: string; phone?: string; email?: string }
  ) => Promise<void>;
  onShowCalls: (name: string) => void;
}) {
  if (!member) return null;
  return (
    <MemberEditorForm
      key={member.id}
      member={member}
      open={open}
      onOpenChange={onOpenChange}
      onSave={onSave}
      onShowCalls={onShowCalls}
    />
  );
}

function MemberEditorForm({
  member,
  open,
  onOpenChange,
  onSave,
  onShowCalls,
}: {
  member: Member;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (
    id: string,
    input: { name: string; phone?: string; email?: string }
  ) => Promise<void>;
  onShowCalls: (name: string) => void;
}) {
  const [name, setName] = useState(member.name);
  const [phone, setPhone] = useState(member.phone);
  const [email, setEmail] = useState(member.email);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave(member.id, {
        name: trimmed,
        phone: phone.trim(),
        email: email.trim(),
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="px-4 pb-6">
        <SheetHeader className="px-0 text-left">
          <SheetTitle className="font-heading text-2xl tracking-wide">
            Edit teammate
          </SheetTitle>
          <SheetDescription>
            Update name, phone, or email. Renaming also updates their assigned calls.
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
            placeholder="Name"
            className="h-12 text-base"
            autoFocus
          />
          <Input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Phone (optional)"
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
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <SheetFooter className="flex-col gap-2 px-0 sm:flex-col">
            <Button type="submit" className="h-14 w-full text-base" disabled={busy}>
              {busy ? "Saving…" : "Save teammate"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full"
              onClick={() => onShowCalls(member.name)}
            >
              See their sponsor calls
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
