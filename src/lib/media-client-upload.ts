"use client";

import { upload } from "@vercel/blob/client";

import {
  ensureMediaFileName,
  fallbackFileName,
  looksLikeVideo,
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
    return {
      clientUpload: Boolean(data.clientUpload),
      maxBytes: Number(data.maxBytes) || MAX_MEDIA_SERVER_BYTES,
      vercel: Boolean(data.vercel),
    };
  } catch {
    return {
      clientUpload: false,
      maxBytes: MAX_MEDIA_SERVER_BYTES,
      vercel: false,
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

function rejectIfTooLarge(file: File, config: MediaUploadConfig) {
  const isVideo = looksLikeVideo(file.name, file.type);
  if (videoTooLargeForHost({ isVideo, size: file.size, ...config })) {
    throw new Error(VIDEO_TOO_LARGE_HOST);
  }
  if (file.size > config.maxBytes) {
    throw new Error(
      `${file.name || "File"} is too large (max ${Math.round(config.maxBytes / (1024 * 1024))} MB)`
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

  await upload(pathname, file, {
    access: "public",
    handleUploadUrl: "/api/media/upload",
    multipart: file.size > MAX_SERVERLESS_POST_BYTES,
    contentType: mimeType || undefined,
    clientPayload: JSON.stringify({
      id,
      fileName: storedName,
      mimeType,
      size: file.size,
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
      size: file.size,
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
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        media: payload.media,
        error: payload.error,
      });
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(form);
  });
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

    if (config.clientUpload) {
      try {
        uploaded.push(
          await uploadMediaViaBlob(file, {
            actor: options.actor,
            durationSeconds,
            onProgress,
          })
        );
        continue;
      } catch (error) {
        const isVideo = looksLikeVideo(file.name, file.type);
        if (isVideo && file.size > MAX_SERVERLESS_POST_BYTES) {
          throw new Error(VIDEO_TOO_LARGE_HOST);
        }
        if (file.size > MAX_SERVERLESS_POST_BYTES) {
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
