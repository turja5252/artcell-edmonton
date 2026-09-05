"use client";

import { useRef } from "react";
import { Download, FileText, ImageIcon, Trash2, Upload } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { formatTime } from "@/lib/people";
import type { MediaItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  items: MediaItem[];
  uploading: boolean;
  removingId: string | null;
  error?: string;
  onRetry?: () => void;
  onUpload: (files: FileList) => void;
  onDelete: (item: MediaItem) => void;
};

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaBoard({
  items,
  uploading,
  removingId,
  error,
  onRetry,
  onUpload,
  onDelete,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const sorted = [...items].sort(
    (a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt)
  );

  return (
    <div className="space-y-3 pb-24">
      <p className="text-sm text-muted-foreground">
        Promo photos and PDFs for the show. Anyone can add.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif"
        multiple
        className="hidden"
        disabled={uploading}
        onChange={(event) => {
          const files = event.target.files;
          if (files?.length) onUpload(files);
          event.target.value = "";
        }}
      />

      <Button
        type="button"
        variant="secondary"
        className="h-12 w-full gap-2"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-4" />
        {uploading ? "Uploading…" : "Upload photo or PDF"}
      </Button>

      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
          {onRetry ? (
            <Button type="button" variant="ghost" className="ml-2 h-8" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}

      {sorted.length === 0 && !uploading ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center">
          <ImageIcon className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No promo files yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Promo photos and PDFs for the show. Anyone can add.
          </p>
        </div>
      ) : null}

      {uploading && sorted.length === 0 ? (
        <div className="rounded-2xl border border-border/80 bg-card/80 p-6 text-center text-sm text-muted-foreground">
          Uploading…
        </div>
      ) : null}

      {sorted.length > 0 ? (
        <ul className="space-y-2">
          {sorted.map((item) => {
            const href = `/api/media/${item.id}`;
            const isPhoto = item.mimeType.startsWith("image/");
            return (
              <li key={item.id}>
                <article
                  className={cn(
                    "rounded-2xl border border-border/80 bg-card/80 p-3",
                    removingId === item.id && "opacity-60"
                  )}
                >
                  <div className="flex gap-3">
                    {isPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={href}
                        alt={item.fileName}
                        className="size-16 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <FileText className="size-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.fileName}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {isPhoto ? "Photo" : "PDF"} · {formatSize(item.size)}
                        {item.uploadedBy ? ` · ${item.uploadedBy}` : ""}
                        {item.uploadedAt ? ` · ${formatTime(item.uploadedAt)}` : ""}
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
                          download={item.fileName}
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
                          disabled={removingId === item.id || uploading}
                          onClick={() => onDelete(item)}
                        >
                          <Trash2 className="size-3.5" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
