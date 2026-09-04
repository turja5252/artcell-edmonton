"use client";

import { useEffect, useRef, useState } from "react";
import { Contact, FileUp, Smartphone } from "lucide-react";

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
import {
  contactKey,
  contactsPickerSupported,
  parseContactFile,
  pickPhoneContacts,
  type PhoneContact,
} from "@/lib/phone-contacts";
import { cn } from "@/lib/utils";

export type AddGuestInput = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  assignedTo: string | null;
  partySize: number;
};

type Props = {
  open: boolean;
  me: string;
  people: string[];
  onOpenChange: (open: boolean) => void;
  onAdd: (input: AddGuestInput) => Promise<void>;
  onAddMany: (inputs: AddGuestInput[]) => Promise<{ added: number; skipped: number }>;
};

type Mode = "form" | "review";

export function AddGuest({ open, me, people, onOpenChange, onAdd, onAddMany }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("form");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [assignedTo, setAssignedTo] = useState(me);
  const [partySize, setPartySize] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pickerAvailable, setPickerAvailable] = useState(false);
  const [drafts, setDrafts] = useState<(PhoneContact & { selected: boolean })[]>([]);

  useEffect(() => {
    setPickerAvailable(contactsPickerSupported());
  }, []);

  useEffect(() => {
    if (!open) return;
    setAssignedTo(me);
    setMode("form");
    setError("");
    setDrafts([]);
  }, [open, me]);

  function resetForm() {
    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
    setPartySize("1");
    setDrafts([]);
    setMode("form");
    setError("");
  }

  async function submitOne() {
    const first = firstName.trim();
    const last = lastName.trim();
    if (!first && !last) {
      setError("Add a first or last name.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onAdd({
        firstName: first,
        lastName: last,
        phone: phone.trim(),
        email: email.trim(),
        assignedTo: assignedTo.trim() || null,
        partySize: Math.max(1, Number(partySize) || 1),
      });
      resetForm();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add this person");
    } finally {
      setBusy(false);
    }
  }

  function loadDrafts(contacts: PhoneContact[]) {
    if (!contacts.length) {
      setError("No contacts found to import.");
      return;
    }
    const seen = new Set<string>();
    const next = contacts
      .map((contact) => ({ ...contact, selected: true }))
      .filter((contact) => {
        const key = contactKey(contact);
        if (seen.has(key)) return false;
        seen.add(key);
        return Boolean(contact.firstName || contact.lastName || contact.phone);
      });
    if (!next.length) {
      setError("No contacts found to import.");
      return;
    }
    setDrafts(next);
    setMode("review");
    setError("");
  }

  async function fromPhonePicker() {
    setBusy(true);
    setError("");
    try {
      const contacts = await pickPhoneContacts();
      loadDrafts(contacts);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not open contacts";
      if (/abort|cancel/i.test(message)) {
        setError("");
      } else {
        setError(
          "Contact picker needs Chrome on Android (and HTTPS). On iPhone, export a .vcf and import it below."
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function fromFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const contacts = await parseContactFile(file);
      loadDrafts(contacts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that file");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submitMany() {
    const selected = drafts.filter((draft) => draft.selected);
    if (!selected.length) {
      setError("Select at least one contact.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await onAddMany(
        selected.map((draft) => ({
          firstName: draft.firstName,
          lastName: draft.lastName,
          phone: draft.phone,
          email: draft.email,
          assignedTo: assignedTo.trim() || null,
          partySize: 1,
        }))
      );
      resetForm();
      onOpenChange(false);
      if (!result.added && result.skipped) {
        setError("Those contacts are already on the list.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add contacts");
    } finally {
      setBusy(false);
    }
  }

  const selectedCount = drafts.filter((draft) => draft.selected).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto px-4 pb-6">
        <SheetHeader className="px-0 text-left">
          <SheetTitle className="font-heading text-2xl tracking-wide">
            {mode === "review" ? "Review phone contacts" : "Add someone to call"}
          </SheetTitle>
          <SheetDescription>
            {mode === "review"
              ? "Uncheck anyone you don’t want, assign a teammate, then add them to the call list."
              : "Type a person in, pick from your phone book (Android Chrome), or import a .vcf / .csv from iPhone or Android."}
          </SheetDescription>
        </SheetHeader>

        {mode === "form" ? (
          <div className="mt-4 space-y-4">
            <section className="space-y-2 rounded-2xl border border-border/80 bg-card/60 p-3">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                From your phone
              </p>
              <div className="grid gap-2">
                <Button
                  type="button"
                  className="h-12 justify-start gap-2"
                  variant={pickerAvailable ? "default" : "secondary"}
                  disabled={busy}
                  onClick={() => void fromPhonePicker()}
                >
                  <Smartphone className="size-4" />
                  {pickerAvailable
                    ? "Choose from phone contacts"
                    : "Phone picker (Android Chrome)"}
                </Button>
                {!pickerAvailable ? (
                  <p className="text-xs text-muted-foreground">
                    Direct contact picking works in Chrome on Android. On iPhone, export contacts as a
                    vCard and import the file below.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Opens your Android contact list. You can select more than one person.
                  </p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 justify-start gap-2"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  <FileUp className="size-4" />
                  Import .vcf or .csv
                </Button>
                <p className="text-xs text-muted-foreground">
                  iPhone: Contacts → select people → Share Contact → Save to Files, then choose the
                  .vcf here. Android can export .vcf the same way.
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".vcf,.csv,text/vcard,text/csv,text/x-vcard"
                  className="hidden"
                  onChange={(event) => void fromFile(event.target.files?.[0] ?? null)}
                />
              </div>
            </section>

            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void submitOne();
              }}
            >
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Or type one in
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  placeholder="First name"
                  className="h-12 text-base"
                />
                <Input
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  placeholder="Last name"
                  className="h-12 text-base"
                />
              </div>
              <Input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Phone number"
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
              <Input
                value={assignedTo}
                onChange={(event) => setAssignedTo(event.target.value)}
                placeholder="Team assignment (optional)"
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
                placeholder="How many members"
                className="h-12 text-base"
              />
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <SheetFooter className="px-0">
                <Button type="submit" className="h-14 w-full text-base" disabled={busy}>
                  {busy ? "Adding…" : "Add to call list"}
                </Button>
              </SheetFooter>
            </form>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {selectedCount} of {drafts.length} selected
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9"
                  onClick={() =>
                    setDrafts((current) => current.map((item) => ({ ...item, selected: true })))
                  }
                >
                  All
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9"
                  onClick={() =>
                    setDrafts((current) => current.map((item) => ({ ...item, selected: false })))
                  }
                >
                  None
                </Button>
              </div>
            </div>

            <Input
              value={assignedTo}
              onChange={(event) => setAssignedTo(event.target.value)}
              placeholder="Assign all selected to…"
              className="h-12 text-base"
              list="guest-team-names-review"
            />
            <datalist id="guest-team-names-review">
              {people.map((person) => (
                <option key={person} value={person} />
              ))}
            </datalist>

            <ul className="max-h-[42vh] space-y-2 overflow-y-auto pr-1">
              {drafts.map((draft, index) => {
                const label =
                  `${draft.firstName} ${draft.lastName}`.trim() || draft.phone || "Contact";
                return (
                  <li key={`${contactKey(draft)}-${index}`}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left",
                        draft.selected
                          ? "border-primary/50 bg-primary/10"
                          : "border-border/80 bg-card/60 opacity-70"
                      )}
                      onClick={() =>
                        setDrafts((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, selected: !item.selected } : item
                          )
                        )
                      }
                    >
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                        <Contact className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium">{label}</span>
                        {draft.phone ? (
                          <span className="block text-sm text-muted-foreground">{draft.phone}</span>
                        ) : (
                          <span className="block text-sm text-muted-foreground">No phone</span>
                        )}
                        {draft.email ? (
                          <span className="block text-sm text-muted-foreground">{draft.email}</span>
                        ) : null}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {draft.selected ? "In" : "Out"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <SheetFooter className="flex-col gap-2 px-0 sm:flex-col">
              <Button
                type="button"
                className="h-14 w-full text-base"
                disabled={busy || selectedCount === 0}
                onClick={() => void submitMany()}
              >
                {busy
                  ? "Adding…"
                  : `Add ${selectedCount} contact${selectedCount === 1 ? "" : "s"}`}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full"
                disabled={busy}
                onClick={() => {
                  setMode("form");
                  setDrafts([]);
                  setError("");
                }}
              >
                Back
              </Button>
            </SheetFooter>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
