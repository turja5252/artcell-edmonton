"use client";

import { put } from "@vercel/blob/client";

import {
  CLIP_OVER_SERVER_UPLOAD,
  fallbackFileName,
  formatMaxMb,
  isUnknownFileSize,
  looksLikeVideo,
  MAX_MEDIA_BLOB_BYTES,
  MAX_SERVERLESS_POST_BYTES,
  MEDIA_UPLOAD_FAILED,
  VIDEO_TOO_LARGE_HOST,
} from "@/lib/media-types";
import type { MediaItem } from "@/lib/types";

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

function rejectIfTooLarge(file: File) {
  if (isUnknownFileSize(file.size)) return;
  if (file.size > MAX_MEDIA_BLOB_BYTES) {
    throw new Error(
      looksLikeVideo(file.name, file.type)
        ? VIDEO_TOO_LARGE_HOST
        : `${file.name || "File"} is too large (max ${formatMaxMb(MAX_MEDIA_BLOB_BYTES)})`
    );
  }
}

function canAttemptServerPut(file: File): boolean {
  return isUnknownFileSize(file.size) || file.size <= MAX_SERVERLESS_POST_BYTES;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isPayloadTooLarge(error: unknown): boolean {
  return /413|too large|payload|entity too large|over 4\.5MB/i.test(errorText(error));
}

function isMintFailure(error: unknown): boolean {
  return (
    errorText(error) === CLIP_OVER_SERVER_UPLOAD ||
    /could not mint|canMint["']?\s*:\s*false|409/i.test(errorText(error))
  );
}

function friendlyMediaError(error: unknown): Error {
  const message = errorText(error);
  if (
    message === CLIP_OVER_SERVER_UPLOAD ||
    message === VIDEO_TOO_LARGE_HOST ||
    message.includes("Only photos") ||
    message.includes("too large") ||
    message.includes("Empty")
  ) {
    return error instanceof Error ? error : new Error(message);
  }
  if (!message || message === "Upload failed") return new Error(MEDIA_UPLOAD_FAILED);
  return error instanceof Error ? error : new Error(message);
}

type FormUploadResult = { media?: MediaItem[]; item?: MediaItem; error?: string; ok: boolean };

function readXhrPayload(xhr: XMLHttpRequest): FormUploadResult {
  const payload = (xhr.response || {}) as { media?: MediaItem[]; item?: MediaItem; error?: string };
  const raw = typeof xhr.response === "string" ? xhr.response : payload.error || "";
  const tooLarge =
    xhr.status === 413 || /too large|payload|entity too large|413/i.test(String(raw));
  return {
    ok: xhr.status >= 200 && xhr.status < 300,
    media: payload.media,
    item: payload.item,
    error: tooLarge ? CLIP_OVER_SERVER_UPLOAD : payload.error,
  };
}

function postMediaForm(
  form: FormData,
  onProgress?: (percent: number) => void
): Promise<FormUploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/media");
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => resolve(readXhrPayload(xhr));
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(form);
  });
}

async function uploadMediaViaServer(
  file: File,
  options: {
    actor: string | null;
    durationSeconds: number | null;
    onProgress?: (percent: number) => void;
  }
): Promise<MediaItem> {
  const form = new FormData();
  if (options.actor) form.set("actor", options.actor);
  if (options.durationSeconds) form.set("durationSeconds", String(options.durationSeconds));
  form.append("files", file, fallbackFileName(file));

  const result = await postMediaForm(form, options.onProgress);
  const item = result.item || result.media?.[0];
  if (result.ok && item) return item;
  throw new Error(result.error || MEDIA_UPLOAD_FAILED);
}

type MintedToken = {
  token: string;
  id: string;
  pathname: string;
  fileName: string;
  mimeType: string;
};

async function mintClientToken(file: File, idHint?: string): Promise<MintedToken | null> {
  const response = await fetch("/api/media/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: idHint,
      fileName: fallbackFileName(file),
      mimeType: file.type || "",
      size: isUnknownFileSize(file.size) ? 0 : file.size,
    }),
  });
  const data = (await response.json()) as Partial<MintedToken> & {
    error?: string;
    canMint?: boolean;
  };
  if (!response.ok || !data.token || !data.pathname || !data.id) {
    return null;
  }
  return {
    token: data.token,
    id: data.id,
    pathname: data.pathname,
    fileName: data.fileName || fallbackFileName(file),
    mimeType: data.mimeType || file.type || "",
  };
}

async function uploadMediaViaMintedToken(
  file: File,
  options: {
    actor: string | null;
    durationSeconds: number | null;
    onProgress?: (percent: number) => void;
  }
): Promise<MediaItem> {
  const minted = await mintClientToken(file);
  if (!minted) {
    throw new Error(CLIP_OVER_SERVER_UPLOAD);
  }

  await put(minted.pathname, file, {
    access: "public",
    token: minted.token,
    contentType: minted.mimeType || undefined,
    multipart: isUnknownFileSize(file.size) || file.size > MAX_SERVERLESS_POST_BYTES,
    onUploadProgress: ({ percentage }) => {
      options.onProgress?.(Math.round(percentage));
    },
  });

  const response = await fetch("/api/media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: minted.id,
      fileName: minted.fileName,
      mimeType: minted.mimeType,
      size: isUnknownFileSize(file.size) ? 0 : file.size,
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

export async function uploadMediaFiles(
  files: File[],
  options: {
    actor: string | null;
    onProgress?: (percent: number) => void;
  }
): Promise<MediaItem[]> {
  const uploaded: MediaItem[] = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    rejectIfTooLarge(file);
    const durationSeconds = await readVideoDuration(file);
    const span = 100 / files.length;
    const base = index * span;
    const onProgress = (percent: number) => {
      options.onProgress?.(Math.round(base + (percent / 100) * span));
    };
    const shared = { actor: options.actor, durationSeconds, onProgress };

    let serverError: unknown;
    if (canAttemptServerPut(file)) {
      try {
        uploaded.push(await uploadMediaViaServer(file, shared));
        continue;
      } catch (error) {
        serverError = error;
        const knownSmall =
          !isUnknownFileSize(file.size) && file.size <= MAX_SERVERLESS_POST_BYTES;
        if (knownSmall && !isPayloadTooLarge(error)) {
          throw friendlyMediaError(error);
        }
      }
    }

    try {
      uploaded.push(await uploadMediaViaMintedToken(file, shared));
    } catch (error) {
      if (isMintFailure(error) || isPayloadTooLarge(serverError)) {
        throw new Error(CLIP_OVER_SERVER_UPLOAD);
      }
      throw friendlyMediaError(error);
    }
  }

  return uploaded;
}
