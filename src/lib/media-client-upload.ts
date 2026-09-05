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
  mediaBlobPathname,
  type BlobClientUploadMode,
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
    const data = (await response.json()) as Partial<MediaUploadConfig>;
    if (!response.ok) throw new Error("config");
    const clientUpload = Boolean(data.clientUpload);
    const mode =
      data.mode === "presigned" || data.mode === "token" ? data.mode : clientUpload ? "presigned" : null;
    return {
      clientUpload,
      mode,
      maxBytes:
        Number(data.maxBytes) ||
        (clientUpload ? MAX_MEDIA_BLOB_BYTES : MAX_MEDIA_SERVER_BYTES),
      vercel: Boolean(data.vercel),
    };
  } catch {
    // Prefer Blob. Falling back to POST on Vercel hits the ~4.5 MB body cap.
    // Production uses OIDC, so default to the presigned client-upload path.
    return {
      clientUpload: true,
      mode: "presigned",
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

function handleUploadUrl(): string {
  if (typeof window === "undefined") return "/api/media/upload";
  return `${window.location.origin}/api/media/upload`;
}

function isTokenRequestError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Failed to retrieve the client token|Failed to retrieve the presigned|No read-write token|No blob credentials|Storage not connected|not available on this host/i.test(
    message
  );
}

function friendlyMediaError(error: unknown, disconnected: boolean): Error {
  const message = error instanceof Error ? error.message : "Upload failed";
  if (
    disconnected ||
    /Storage not connected|not available on this host|No blob credentials|No read-write token/i.test(
      message
    )
  ) {
    return new Error(STORAGE_NOT_CONNECTED);
  }
  if (/Failed to retrieve the client token|Failed to retrieve the presigned/i.test(message)) {
    return new Error(STORAGE_NOT_CONNECTED);
  }
  return error instanceof Error ? error : new Error(message);
}

function preferredModes(config: MediaUploadConfig, isVideo: boolean): BlobClientUploadMode[] {
  const primary: BlobClientUploadMode = config.mode === "token" ? "token" : "presigned";
  const secondary: BlobClientUploadMode = primary === "presigned" ? "token" : "presigned";
  if (isVideo) return [primary, primary, secondary];
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
  const isVideo = looksLikeVideo(fileName, mimeType);
  const modes = preferredModes({ mode: options.mode, clientUpload: true, maxBytes: 0, vercel: true }, isVideo);

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
      if (!isTokenRequestError(error)) throw error;
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
    mode?: BlobClientUploadMode | null;
    onProgress?: (percent: number) => void;
  }
): Promise<MediaItem> {
  try {
    return await uploadMediaViaBlob(file, options);
  } catch (error) {
    if (!isTokenRequestError(error) && !looksLikeVideo(file.name, file.type)) {
      throw error;
    }
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
            mode: config.mode,
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
        const serverCap = config.vercel
          ? MAX_SERVERLESS_POST_BYTES
          : MAX_MEDIA_SERVER_BYTES;
        const canServerPost = known && file.size <= serverCap;
        if (!canServerPost) {
          throw friendlyMediaError(error, !config.clientUpload);
        }
      }
    }

    const form = new FormData();
    if (options.actor) form.set("actor", options.actor);
    if (durationSeconds) form.set("durationSeconds", String(durationSeconds));
    form.append("files", file, fallbackFileName(file));
    try {
      const result = await postMediaForm(form, onProgress);
      if (!result.ok) {
        throw friendlyMediaError(new Error(result.error || "Upload failed"), !config.clientUpload);
      }
      if (result.media?.length) uploaded.push(...result.media);
    } catch (error) {
      throw friendlyMediaError(error, !config.clientUpload);
    }
  }

  return uploaded;
}
