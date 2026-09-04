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

type Props = {
  open: boolean;
  title: string;
  description: string;
  label: string;
  value: number;
  onOpenChange: (open: boolean) => void;
  onSave: (value: number) => Promise<void>;
};

export function TargetEditor({
  open,
  title,
  description,
  label,
  value,
  onOpenChange,
  onSave,
}: Props) {
  const [draft, setDraft] = useState(value ? String(value) : "");
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(value ? String(value) : "");
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl tracking-wide">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            void onSave(Number(draft.replace(/[^0-9.]/g, "")) || 0)
              .then(() => onOpenChange(false))
              .finally(() => setBusy(false));
          }}
        >
          <label className="block text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {label}
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              inputMode="decimal"
              className="mt-1 h-12 text-base"
              autoFocus
            />
          </label>
          <DialogFooter>
            <Button type="submit" className="h-12 w-full" disabled={busy}>
              {busy ? "Saving…" : "Save target"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
