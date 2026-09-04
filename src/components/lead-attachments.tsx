"use client";

import { useRef, useState } from "react";
import { Download, FileText, ImageIcon, Trash2, Upload } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import type { Lead, LeadAttachment } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  lead: Lead;
  me: string;
  onLeadChange: (lead: Lead) => void;
};

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function LeadAttachments({ lead, me, onLeadChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      if (me) form.set("actor", me);
      for (const file of Array.from(files)) {
        form.append("files", file);
      }
      const response = await fetch(`/api/leads/${lead.id}/attachments`, {
        method: "POST",
        body: form,
      });
      const data = (await response.json()) as { lead?: Lead; error?: string };
      if (!response.ok) throw new Error(data.error || "Upload failed");
      if (data.lead) onLeadChange(data.lead);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(attachment: LeadAttachment) {
    setRemovingId(attachment.id);
    setError("");
    try {
      const response = await fetch(
        `/api/leads/${lead.id}/attachments/${attachment.id}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actor: me || null }),
        }
      );
      const data = (await response.json()) as { lead?: Lead; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not delete file");
      if (data.lead) onLeadChange(data.lead);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete file");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section className="space-y-2">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Files · photos & PDFs
      </p>
      <p className="text-sm text-muted-foreground">
        Upload posters, logos, or PDF docs for this sponsor. Multiple files allowed.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif"
        multiple
        className="hidden"
        onChange={(event) => void upload(event.target.files)}
      />

      <Button
        type="button"
        variant="secondary"
        className="h-12 w-full gap-2"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-4" />
        {busy ? "Uploading…" : "Upload photo or PDF"}
      </Button>

      {lead.attachments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          No files yet
        </div>
      ) : (
        <ul className="space-y-2">
          {lead.attachments.map((attachment) => {
            const href = `/api/leads/${lead.id}/attachments/${attachment.id}`;
            const isPhoto = attachment.mimeType.startsWith("image/");
            return (
              <li key={attachment.id}>
                <article
                  className={cn(
                    "rounded-2xl border border-border/80 bg-card/80 p-3",
                    removingId === attachment.id && "opacity-60"
                  )}
                >
                  <div className="flex gap-3">
                    {isPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={href}
                        alt={attachment.fileName}
                        className="size-16 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <FileText className="size-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{attachment.fileName}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {isPhoto ? "Photo" : "PDF"} · {formatSize(attachment.size)}
                        {attachment.uploadedBy ? ` · ${attachment.uploadedBy}` : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className={cn(
                            buttonVariants({ variant: "outline" }),
                            "h-10 gap-1.5 px-3"
                          )}
                        >
                          {isPhoto ? (
                            <ImageIcon className="size-3.5" />
                          ) : (
                            <FileText className="size-3.5" />
                          )}
                          Open
                        </a>
                        <a
                          href={`${href}?download=1`}
                          download={attachment.fileName}
                          className={cn(
                            buttonVariants({ variant: "outline" }),
                            "h-10 gap-1.5 px-3"
                          )}
                        >
                          <Download className="size-3.5" />
                          Download
                        </a>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-10 px-3 text-destructive"
                          disabled={removingId === attachment.id}
                          onClick={() => void remove(attachment)}
                        >
                          <Trash2 className="size-3.5" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
