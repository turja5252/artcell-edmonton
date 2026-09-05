"use client";

import { useRef, useState } from "react";
import { Download, FileText, Film, ImageIcon, Trash2, Upload } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  formatByteSize,
  formatMediaDuration,
  isPhotoMime,
  isVideoMime,
  MEDIA_FILE_ACCEPT,
} from "@/lib/media-types";
import { formatTime } from "@/lib/people";
import type { MediaItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  items: MediaItem[];
  uploading: boolean;
  uploadProgress?: number | null;
  removingId: string | null;
  error?: string;
  onRetry?: () => void;
  onUpload: (files: FileList) => void;
  onDelete: (item: MediaItem) => void;
};

function kindLabel(item: MediaItem): string {
  if (isVideoMime(item.mimeType)) return "Video";
  if (isPhotoMime(item.mimeType)) return "Photo";
  return "PDF";
}

function VideoPreview({ src, fileName }: { src: string; fileName: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="flex aspect-video max-h-52 w-full items-center justify-center rounded-xl bg-muted">
        <Film className="size-8 text-muted-foreground" />
      </div>
    );
  }
  return (
    <video
      src={src}
      className="aspect-video max-h-52 w-full rounded-xl bg-black object-contain"
      controls
      playsInline
      preload="metadata"
      onError={() => setFailed(true)}
      aria-label={fileName}
    />
  );
}

export function MediaBoard({
  items,
  uploading,
  uploadProgress,
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

  const progress =
    uploading && typeof uploadProgress === "number"
      ? Math.max(0, Math.min(100, Math.round(uploadProgress)))
      : null;

  return (
    <div className="space-y-3 pb-24">
      <p className="text-sm text-muted-foreground">
        Promo photos, videos, and PDFs. Phone clips belong here — not on a sponsor card.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept={MEDIA_FILE_ACCEPT}
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
        {uploading
          ? progress !== null
            ? `Uploading… ${progress}%`
            : "Uploading…"
          : "Upload photo, video, or PDF"}
      </Button>

      {uploading && progress !== null ? (
        <div
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-label="Upload progress"
        >
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      ) : null}

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
            Promo photos, videos, and PDFs. Phone clips are fine.
          </p>
        </div>
      ) : null}

      {uploading && sorted.length === 0 ? (
        <div className="rounded-2xl border border-border/80 bg-card/80 p-6 text-center text-sm text-muted-foreground">
          {progress !== null ? `Uploading… ${progress}%` : "Uploading…"}
        </div>
      ) : null}

      {sorted.length > 0 ? (
        <ul className="space-y-2">
          {sorted.map((item) => {
            const href = `/api/media/${item.id}`;
            const isPhoto = isPhotoMime(item.mimeType);
            const isVideo = isVideoMime(item.mimeType);
            const duration = item.durationSeconds
              ? formatMediaDuration(item.durationSeconds)
              : "";
            return (
              <li key={item.id}>
                <article
                  className={cn(
                    "rounded-2xl border border-border/80 bg-card/80 p-3",
                    removingId === item.id && "opacity-60"
                  )}
                >
                  <div className={cn(isVideo ? "space-y-3" : "flex gap-3")}>
                    {isVideo ? (
                      <VideoPreview src={href} fileName={item.fileName} />
                    ) : isPhoto ? (
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
                        {kindLabel(item)}
                        {duration ? ` · ${duration}` : ""}
                        {` · ${formatByteSize(item.size)}`}
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
                          {isVideo ? (
                            <Film className="size-3.5" />
                          ) : isPhoto ? (
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
