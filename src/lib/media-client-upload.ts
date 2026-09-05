"use client";

import { upload } from "@vercel/blob/client";

import {
  ensureMediaFileName,
  fallbackFileName,
  formatMaxMb,
  isUnknownFileSize,
  looksLikeVideo,
  MAX_MEDIA_BLOB_BYTES,
  MAX_MEDIA_SERVER_BYTES,
  MAX_SERVERLESS_POST_BYTES,
  mediaBlobPathname,
  type MediaUploadConfig,
  newMediaId,
  resolveMediaMime,
  VIDEO_TOO_LARGE_HOST,
  videoTooLargeForHost,
} from "@/lib/media-types";
import type { MediaItem } from "@/lib/types";

export async function readMediaUploadConfig(): Promise<MediaUploadConfig> {
  try {
    const response = await fetch("/api/media/upload", { cache: "no-store" });
    const data = (await response.json()) as Partial<MediaUploadConfig>;
    if (!response.ok) throw new Error("config");
    const clientUpload = Boolean(data.clientUpload);
    return {
      clientUpload,
      maxBytes:
        Number(data.maxBytes) ||
        (clientUpload ? MAX_MEDIA_BLOB_BYTES : MAX_MEDIA_SERVER_BYTES),
      vercel: Boolean(data.vercel),
    };
  } catch {
    // Prefer Blob. Falling back to POST on Vercel hits the ~4.5 MB body cap.
    return {
      clientUpload: true,
      maxBytes: MAX_MEDIA_BLOB_BYTES,
      vercel: true,
    };
  }
}

export function readVideoDuration(file: File): Promise<number | null> {
  if (!looksLikeVideo(file.name, file.type)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    const finish = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    video.onloadedmetadata = () => {
      const duration = video.duration;
      finish(Number.isFinite(duration) && duration > 0 ? duration : null);
    };
    video.onerror = () => finish(null);
    window.setTimeout(() => finish(null), 4000);
    video.src = url;
  });
}

function videoMaxBytes(config: MediaUploadConfig): number {
  return config.clientUpload
    ? Math.max(config.maxBytes || 0, MAX_MEDIA_BLOB_BYTES)
    : Math.max(config.maxBytes || 0, MAX_MEDIA_SERVER_BYTES);
}

function rejectIfTooLarge(file: File, config: MediaUploadConfig) {
  if (isUnknownFileSize(file.size)) return;
  const isVideo = looksLikeVideo(file.name, file.type);
  if (isVideo) {
    if (videoTooLargeForHost({ isVideo, size: file.size, ...config })) {
      throw new Error(VIDEO_TOO_LARGE_HOST);
    }
    return;
  }
  if (file.size > config.maxBytes) {
    throw new Error(
      `${file.name || "File"} is too large (max ${formatMaxMb(config.maxBytes)})`
    );
  }
}

export async function uploadMediaViaBlob(
  file: File,
  options: {
    actor: string | null;
    durationSeconds: number | null;
    onProgress?: (percent: number) => void;
  }
): Promise<MediaItem> {
  const fileName = fallbackFileName(file);
  const mimeType = resolveMediaMime(fileName, file.type) || file.type || "";
  const storedName = ensureMediaFileName(fileName, mimeType);
  const id = newMediaId();
  const pathname = mediaBlobPathname(id, storedName, mimeType);
  const unknownSize = isUnknownFileSize(file.size);

  await upload(pathname, file, {
    access: "public",
    handleUploadUrl: "/api/media/upload",
    multipart: unknownSize || file.size > MAX_SERVERLESS_POST_BYTES,
    contentType: mimeType || undefined,
    clientPayload: JSON.stringify({
      id,
      fileName: storedName,
      mimeType,
      size: unknownSize ? 0 : file.size,
      actor: options.actor,
      durationSeconds: options.durationSeconds,
    }),
    onUploadProgress: ({ percentage }) => {
      options.onProgress?.(Math.round(percentage));
    },
  });

  const response = await fetch("/api/media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id,
      fileName: storedName,
      mimeType,
      size: unknownSize ? 0 : file.size,
      durationSeconds: options.durationSeconds,
      actor: options.actor,
    }),
  });
  const data = (await response.json()) as { item?: MediaItem; media?: MediaItem[]; error?: string };
  if (!response.ok) throw new Error(data.error || "Upload failed");
  const item = data.item || data.media?.[0];
  if (!item) throw new Error("Upload failed");
  return item;
}

export function postMediaForm(
  form: FormData,
  onProgress?: (percent: number) => void
): Promise<{ media?: MediaItem[]; error?: string; ok: boolean }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/media");
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      const payload = (xhr.response || {}) as { media?: MediaItem[]; error?: string };
      const raw =
        typeof xhr.response === "string"
          ? xhr.response
          : payload.error || "";
      const tooLarge =
        xhr.status === 413 ||
        /too large|payload|entity too large|413/i.test(String(raw));
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        media: payload.media,
        error: tooLarge
          ? "Upload is too big for this path. Use the Media tab so the video goes to Blob."
          : payload.error,
      });
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(form);
  });
}

async function uploadMediaViaBlobWithRetry(
  file: File,
  options: {
    actor: string | null;
    durationSeconds: number | null;
    onProgress?: (percent: number) => void;
  }
): Promise<MediaItem> {
  try {
    return await uploadMediaViaBlob(file, options);
  } catch {
    return await uploadMediaViaBlob(file, options);
  }
}

export async function uploadMediaFiles(
  files: File[],
  options: {
    actor: string | null;
    onProgress?: (percent: number) => void;
  }
): Promise<MediaItem[]> {
  const config = await readMediaUploadConfig();
  const uploaded: MediaItem[] = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    rejectIfTooLarge(file, config);
    const durationSeconds = await readVideoDuration(file);
    const span = 100 / files.length;
    const base = index * span;
    const onProgress = (percent: number) => {
      options.onProgress?.(Math.round(base + (percent / 100) * span));
    };
    const isVideo = looksLikeVideo(file.name, file.type);
    const tryBlob = config.clientUpload || isVideo;

    if (tryBlob) {
      try {
        uploaded.push(
          await uploadMediaViaBlobWithRetry(file, {
            actor: options.actor,
            durationSeconds,
            onProgress,
          })
        );
        continue;
      } catch (error) {
        const known = !isUnknownFileSize(file.size);
        if (known && file.size > videoMaxBytes(config)) {
          throw new Error(
            `${file.name || "File"} is too large (max ${formatMaxMb(videoMaxBytes(config))})`
          );
        }
        const canServerPost = known && file.size <= MAX_SERVERLESS_POST_BYTES;
        if (!canServerPost) {
          throw error instanceof Error ? error : new Error("Upload failed");
        }
      }
    }

    const form = new FormData();
    if (options.actor) form.set("actor", options.actor);
    if (durationSeconds) form.set("durationSeconds", String(durationSeconds));
    form.append("files", file, fallbackFileName(file));
    const result = await postMediaForm(form, onProgress);
    if (!result.ok) throw new Error(result.error || "Upload failed");
    if (result.media?.length) uploaded.push(...result.media);
  }

  return uploaded;
}
