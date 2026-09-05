"use client";

import { upload, uploadPresigned } from "@vercel/blob/client";

import {
  ensureMediaFileName,
  fallbackFileName,
  formatMaxMb,
  isUnknownFileSize,
  looksLikeVideo,
  MAX_MEDIA_BLOB_BYTES,
  MAX_MEDIA_SERVER_BYTES,
  MAX_SERVERLESS_POST_BYTES,
  MEDIA_UPLOAD_FAILED,
  mediaBlobPathname,
  SMALL_VIDEO_OK_BYTES,
  type BlobClientUploadMode,
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
    const mode =
      data.mode === "presigned" || data.mode === "token"
        ? data.mode
        : clientUpload
          ? "presigned"
          : null;
    return {
      clientUpload,
      mode,
      serverUpload: data.serverUpload !== false,
      maxBytes:
        Number(data.maxBytes) ||
        (clientUpload ? MAX_MEDIA_BLOB_BYTES : MAX_MEDIA_SERVER_BYTES),
      serverMaxBytes: Number(data.serverMaxBytes) || SMALL_VIDEO_OK_BYTES,
      vercel: Boolean(data.vercel),
    };
  } catch {
    return {
      clientUpload: true,
      mode: "presigned",
      serverUpload: true,
      maxBytes: MAX_MEDIA_BLOB_BYTES,
      serverMaxBytes: SMALL_VIDEO_OK_BYTES,
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
    : Math.max(config.maxBytes || 0, config.serverMaxBytes || MAX_MEDIA_SERVER_BYTES);
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

function handleUploadUrl(): string {
  if (typeof window === "undefined") return "/api/media/upload";
  return `${window.location.origin}/api/media/upload`;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isClientTokenError(error: unknown): boolean {
  return /Failed to retrieve the client token|Failed to retrieve the presigned|Client token unavailable|No read-write token|No blob credentials|not available on this host|410|retired/i.test(
    errorText(error)
  );
}

function friendlyMediaError(error: unknown): Error {
  const message = errorText(error);
  if (
    message.includes("Only photos") ||
    message.includes("too large") ||
    message.includes("Empty") ||
    message === VIDEO_TOO_LARGE_HOST
  ) {
    return error instanceof Error ? error : new Error(message);
  }
  return new Error(MEDIA_UPLOAD_FAILED);
}

function preferredModes(config: MediaUploadConfig): BlobClientUploadMode[] {
  const primary: BlobClientUploadMode = config.mode === "token" ? "token" : "presigned";
  const secondary: BlobClientUploadMode = primary === "presigned" ? "token" : "presigned";
  return [primary, secondary];
}

async function putViaClient(
  mode: BlobClientUploadMode,
  pathname: string,
  file: File,
  options: {
    mimeType: string;
    clientPayload: string;
    multipart: boolean;
    onProgress?: (percent: number) => void;
  }
) {
  const common = {
    access: "public" as const,
    handleUploadUrl: handleUploadUrl(),
    multipart: options.multipart,
    contentType: options.mimeType || undefined,
    clientPayload: options.clientPayload,
    headers: { "cache-control": "no-store" },
    onUploadProgress: ({ percentage }: { percentage: number }) => {
      options.onProgress?.(Math.round(percentage));
    },
  };
  const send = mode === "presigned" ? uploadPresigned : upload;
  await send(pathname, file, common);
}

export async function uploadMediaViaBlob(
  file: File,
  options: {
    actor: string | null;
    durationSeconds: number | null;
    mode?: BlobClientUploadMode | null;
    onProgress?: (percent: number) => void;
  }
): Promise<MediaItem> {
  const fileName = fallbackFileName(file);
  const mimeType = resolveMediaMime(fileName, file.type) || file.type || "";
  const storedName = ensureMediaFileName(fileName, mimeType);
  const id = newMediaId();
  const pathname = mediaBlobPathname(id, storedName, mimeType);
  const unknownSize = isUnknownFileSize(file.size);
  const clientPayload = JSON.stringify({
    id,
    fileName: storedName,
    mimeType,
    size: unknownSize ? 0 : file.size,
    actor: options.actor,
    durationSeconds: options.durationSeconds,
  });
  const modes = preferredModes({
    mode: options.mode,
    clientUpload: true,
    maxBytes: 0,
    vercel: true,
  });

  let lastError: unknown;
  for (const mode of modes) {
    try {
      await putViaClient(mode, pathname, file, {
        mimeType,
        clientPayload,
        multipart: unknownSize || file.size > MAX_SERVERLESS_POST_BYTES,
        onProgress: options.onProgress,
      });
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      if (!isClientTokenError(error)) throw error;
    }
  }
  if (lastError) throw lastError;

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
    error: tooLarge
      ? "This file is too big for the backup upload path. Try a shorter clip."
      : payload.error,
  };
}

export function postMediaForm(
  form: FormData,
  onProgress?: (percent: number) => void,
  url = "/api/media"
): Promise<FormUploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
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

function postMediaStream(
  file: File,
  options: {
    actor: string | null;
    durationSeconds: number | null;
    onProgress?: (percent: number) => void;
  }
): Promise<FormUploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/media/put");
    xhr.responseType = "json";
    xhr.setRequestHeader("x-media-filename", encodeURIComponent(fallbackFileName(file)));
    if (file.type) xhr.setRequestHeader("x-media-type", file.type);
    if (options.actor) xhr.setRequestHeader("x-media-actor", encodeURIComponent(options.actor));
    if (options.durationSeconds) {
      xhr.setRequestHeader("x-media-duration", String(options.durationSeconds));
    }
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        options.onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => resolve(readXhrPayload(xhr));
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(file);
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
  const streamed = await postMediaStream(file, options);
  const streamedItem = streamed.item || streamed.media?.[0];
  if (streamed.ok && streamedItem) return streamedItem;

  const form = new FormData();
  if (options.actor) form.set("actor", options.actor);
  if (options.durationSeconds) form.set("durationSeconds", String(options.durationSeconds));
  form.append("files", file, fallbackFileName(file));

  const putForm = await postMediaForm(form, options.onProgress, "/api/media/put");
  const putItem = putForm.item || putForm.media?.[0];
  if (putForm.ok && putItem) return putItem;

  const legacy = await postMediaForm(form, options.onProgress, "/api/media");
  const legacyItem = legacy.item || legacy.media?.[0];
  if (legacy.ok && legacyItem) return legacyItem;

  throw new Error(streamed.error || putForm.error || legacy.error || MEDIA_UPLOAD_FAILED);
}

function canAttemptServerPut(file: File, config: MediaUploadConfig): boolean {
  if (isUnknownFileSize(file.size)) return true;
  const cap = Math.max(config.serverMaxBytes || 0, SMALL_VIDEO_OK_BYTES, MAX_MEDIA_SERVER_BYTES);
  return file.size <= cap;
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
    const tryBlob = Boolean(config.mode) || config.clientUpload || isVideo;
    const serverOptions = { actor: options.actor, durationSeconds, onProgress };

    let lastError: unknown;
    if (tryBlob) {
      try {
        uploaded.push(
          await uploadMediaViaBlob(file, {
            actor: options.actor,
            durationSeconds,
            mode: config.mode,
            onProgress,
          })
        );
        continue;
      } catch (error) {
        lastError = error;
        const known = !isUnknownFileSize(file.size);
        if (known && file.size > videoMaxBytes(config) && file.size > SMALL_VIDEO_OK_BYTES) {
          throw new Error(
            `${file.name || "File"} is too large (max ${formatMaxMb(videoMaxBytes(config))})`
          );
        }
      }
    }

    if (!canAttemptServerPut(file, config)) {
      throw friendlyMediaError(lastError || new Error(MEDIA_UPLOAD_FAILED));
    }

    try {
      uploaded.push(await uploadMediaViaServer(file, serverOptions));
    } catch (error) {
      throw friendlyMediaError(lastError || error);
    }
  }

  return uploaded;
}
