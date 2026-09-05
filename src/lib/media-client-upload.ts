"use client";

import { put, uploadPresigned } from "@vercel/blob/client";

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
  type MediaUploadConfig,
  newMediaId,
  resolveMediaMime,
  STORAGE_NOT_CONNECTED,
  VIDEO_TOO_LARGE_HOST,
  videoTooLargeForHost,
} from "@/lib/media-types";
import type { MediaItem } from "@/lib/types";

export async function readMediaUploadConfig(): Promise<MediaUploadConfig> {
  try {
    const response = await fetch("/api/media/upload", { cache: "no-store" });
    const data = (await response.json()) as Partial<MediaUploadConfig> & {
      canMintToken?: boolean;
      blob?: boolean;
    };
    if (!response.ok) throw new Error("config");
    const clientUpload = Boolean(data.clientUpload);
    const reportedMode =
      data.mode === "presigned" || data.mode === "token" ? data.mode : null;
    const oidcOnly = Boolean(data.blob) && data.canMintToken === false;
    const mode = reportedMode ?? (clientUpload || oidcOnly ? "presigned" : null);
    return {
      clientUpload: clientUpload || Boolean(mode),
      mode,
      serverUpload: data.serverUpload !== false,
      canMintToken: Boolean(data.canMintToken),
      maxBytes:
        Number(data.maxBytes) ||
        (clientUpload || mode ? MAX_MEDIA_BLOB_BYTES : MAX_MEDIA_SERVER_BYTES),
      serverMaxBytes: Number(data.serverMaxBytes) || MAX_SERVERLESS_POST_BYTES,
      vercel: Boolean(data.vercel),
    };
  } catch {
    // Production is OIDC-only. Prefer presigned over a 4.5MB POST guess.
    return {
      clientUpload: true,
      mode: "presigned",
      serverUpload: true,
      canMintToken: false,
      maxBytes: MAX_MEDIA_BLOB_BYTES,
      serverMaxBytes: MAX_SERVERLESS_POST_BYTES,
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
  return config.clientUpload || config.mode
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
  return /Failed to retrieve the client token|Failed to retrieve the presigned|Client token unavailable|No read-write token|No blob credentials|not available on this host|410|retired|Presigned upload required/i.test(
    errorText(error)
  );
}

function isPayloadTooLarge(error: unknown): boolean {
  return /413|too large|payload|entity too large|over 4\.5MB/i.test(errorText(error));
}

function friendlyMediaError(error: unknown): Error {
  const message = errorText(error);
  if (isClientTokenError(error)) {
    return new Error(MEDIA_UPLOAD_FAILED);
  }
  if (
    message.includes("Only photos") ||
    message.includes("too large") ||
    message.includes("Empty") ||
    message === VIDEO_TOO_LARGE_HOST ||
    message === STORAGE_NOT_CONNECTED
  ) {
    return error instanceof Error ? error : new Error(message);
  }
  return new Error(MEDIA_UPLOAD_FAILED);
}

function canAttemptServerPut(file: File, config: MediaUploadConfig): boolean {
  if (isUnknownFileSize(file.size)) return true;
  const cap = config.vercel
    ? MAX_SERVERLESS_POST_BYTES
    : Math.max(config.serverMaxBytes || 0, MAX_MEDIA_SERVER_BYTES);
  return file.size <= cap;
}

async function registerUploadedBlob(
  input: {
    id: string;
    fileName: string;
    mimeType: string;
    size: number;
    actor: string | null;
    durationSeconds: number | null;
  }
): Promise<MediaItem> {
  const response = await fetch("/api/media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await response.json()) as { item?: MediaItem; media?: MediaItem[]; error?: string };
  if (!response.ok) throw new Error(data.error || "Upload failed");
  const item = data.item || data.media?.[0];
  if (!item) throw new Error("Upload failed");
  return item;
}

async function uploadMediaViaPresigned(
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
  const clientPayload = JSON.stringify({
    id,
    fileName: storedName,
    mimeType,
    size: unknownSize ? 0 : file.size,
    actor: options.actor,
    durationSeconds: options.durationSeconds,
  });

  await uploadPresigned(pathname, file, {
    access: "public",
    handleUploadUrl: handleUploadUrl(),
    multipart: unknownSize || file.size > MAX_SERVERLESS_POST_BYTES,
    contentType: mimeType || undefined,
    clientPayload,
    headers: { "cache-control": "no-store" },
    onUploadProgress: ({ percentage }: { percentage: number }) => {
      options.onProgress?.(Math.round(percentage));
    },
  });

  return registerUploadedBlob({
    id,
    fileName: storedName,
    mimeType,
    size: unknownSize ? 0 : file.size,
    actor: options.actor,
    durationSeconds: options.durationSeconds,
  });
}

type MintedToken = {
  token: string;
  id: string;
  pathname: string;
  fileName: string;
  mimeType: string;
};

async function mintClientToken(file: File): Promise<MintedToken | null> {
  const response = await fetch("/api/media/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: fallbackFileName(file),
      mimeType: file.type || "",
      size: isUnknownFileSize(file.size) ? 0 : file.size,
    }),
  });
  const data = (await response.json()) as Partial<MintedToken> & { canMint?: boolean };
  if (!response.ok || !data.token || !data.pathname || !data.id) return null;
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
  if (!minted) throw new Error(MEDIA_UPLOAD_FAILED);

  await put(minted.pathname, file, {
    access: "public",
    token: minted.token,
    contentType: minted.mimeType || undefined,
    multipart: isUnknownFileSize(file.size) || file.size > MAX_SERVERLESS_POST_BYTES,
    onUploadProgress: ({ percentage }) => {
      options.onProgress?.(Math.round(percentage));
    },
  });

  return registerUploadedBlob({
    id: minted.id,
    fileName: minted.fileName,
    mimeType: minted.mimeType,
    size: isUnknownFileSize(file.size) ? 0 : file.size,
    actor: options.actor,
    durationSeconds: options.durationSeconds,
  });
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

  const putForm = await postMediaForm(form, options.onProgress, "/api/media/put");
  const putItem = putForm.item || putForm.media?.[0];
  if (putForm.ok && putItem) return putItem;

  const legacy = await postMediaForm(form, options.onProgress, "/api/media");
  const legacyItem = legacy.item || legacy.media?.[0];
  if (legacy.ok && legacyItem) return legacyItem;

  throw new Error(putForm.error || legacy.error || MEDIA_UPLOAD_FAILED);
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
    const shared = { actor: options.actor, durationSeconds, onProgress };
    const useClient = Boolean(config.mode) || config.clientUpload;
    const usePresigned = useClient && config.mode !== "token";
    const useToken = Boolean(config.canMintToken) && (config.mode === "token" || useClient);

    let lastError: unknown;
    if (canAttemptServerPut(file, config)) {
      try {
        uploaded.push(await uploadMediaViaServer(file, shared));
        continue;
      } catch (error) {
        lastError = error;
        const knownSmall =
          !isUnknownFileSize(file.size) && file.size <= MAX_SERVERLESS_POST_BYTES;
        if (knownSmall && !isPayloadTooLarge(error) && !useClient) {
          throw friendlyMediaError(error);
        }
      }
    }

    if (usePresigned) {
      try {
        uploaded.push(await uploadMediaViaPresigned(file, shared));
        continue;
      } catch (error) {
        lastError = error;
        if (!isClientTokenError(error) && !useToken) {
          throw friendlyMediaError(error);
        }
      }
    }

    if (useToken) {
      try {
        uploaded.push(await uploadMediaViaMintedToken(file, shared));
        continue;
      } catch (error) {
        lastError = error;
      }
    }

    if (!usePresigned && useClient) {
      try {
        uploaded.push(await uploadMediaViaPresigned(file, shared));
        continue;
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError && !isUnknownFileSize(file.size) && file.size > videoMaxBytes(config)) {
      throw new Error(
        `${file.name || "File"} is too large (max ${formatMaxMb(videoMaxBytes(config))})`
      );
    }

    throw friendlyMediaError(lastError || new Error(MEDIA_UPLOAD_FAILED));
  }

  return uploaded;
}
