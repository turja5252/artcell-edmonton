/**
 * Server-side Blob `put()` for Media. Same `@vercel/blob` `put` persist.ts uses
 * (OIDC or BLOB_READ_WRITE_TOKEN). Vercel request bodies are often capped at
 * ~4.5 MB — larger files use an OIDC presigned PUT instead of posting here.
 */
import { put } from "@vercel/blob";

import { addMediaItem, registerBlobMediaItem } from "@/lib/store";
import { jsonNoStore } from "@/lib/http";
import {
  assertAllowedMedia,
  ensureMediaFileName,
  fallbackNameFromMime,
  isUnknownFileSize,
  mediaBlobPathname,
  newMediaId,
  SMALL_VIDEO_OK_BYTES,
} from "@/lib/media-types";
import { useBlobStore } from "@/lib/persist";
import type { MediaItem } from "@/lib/types";

export const MEDIA_PUT_MAX_BYTES = SMALL_VIDEO_OK_BYTES;

type PutInput = {
  fileName: string;
  mimeType: string;
  size: number;
  actor: string | null;
  durationSeconds: number | null;
  body: Buffer | ReadableStream<Uint8Array>;
};

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

export async function putOneMediaFile(input: PutInput): Promise<MediaItem> {
  const fileName = input.fileName || fallbackNameFromMime(input.mimeType);
  const size = Number.isFinite(input.size) ? input.size : 0;
  const resolved = assertAllowedMedia(fileName, input.mimeType, size, MEDIA_PUT_MAX_BYTES);
  const storedName = ensureMediaFileName(fileName, resolved);

  if (useBlobStore()) {
    const id = newMediaId();
    const pathname = mediaBlobPathname(id, storedName, resolved);
    const multipart = isUnknownFileSize(size) || size > 4 * 1024 * 1024;
    await put(pathname, input.body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: resolved,
      cacheControlMaxAge: 60 * 60 * 24 * 30,
      multipart,
    });
    return registerBlobMediaItem({
      id,
      fileName: storedName,
      mimeType: resolved,
      size,
      actor: input.actor,
      durationSeconds: input.durationSeconds,
    });
  }

  const bytes = Buffer.isBuffer(input.body) ? input.body : await streamToBuffer(input.body);
  return addMediaItem({
    fileName: storedName,
    mimeType: resolved,
    bytes,
    actor: input.actor,
    durationSeconds: input.durationSeconds,
  });
}

function readDuration(raw: string | null): number | null {
  if (raw === null || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function decodeHeader(value: string | null): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function putMediaFromRequest(request: Request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const actor = String(form.get("actor") ?? "") || null;
    const durationSeconds = readDuration(
      form.get("durationSeconds") === null ? null : String(form.get("durationSeconds"))
    );
    const files = form
      .getAll("files")
      .concat(form.getAll("file"))
      .filter((item): item is File => typeof File !== "undefined" && item instanceof File);
    if (!files.length) {
      return jsonNoStore({ error: "Choose a photo, video, or PDF to upload" }, { status: 400 });
    }
    const items: MediaItem[] = [];
    for (const file of files) {
      items.push(
        await putOneMediaFile({
          fileName: file.name || "upload",
          mimeType: file.type || "",
          size: file.size,
          actor,
          durationSeconds,
          body: Buffer.from(await file.arrayBuffer()),
        })
      );
    }
    return jsonNoStore({ media: items, item: items[items.length - 1] }, { status: 201 });
  }

  if (!request.body) {
    return jsonNoStore({ error: "Choose a photo, video, or PDF to upload" }, { status: 400 });
  }

  const fileName =
    decodeHeader(request.headers.get("x-media-filename")) ||
    fallbackNameFromMime(request.headers.get("x-media-type") || contentType);
  const mimeType =
    decodeHeader(request.headers.get("x-media-type")) || contentType.split(";")[0].trim();
  const actor = decodeHeader(request.headers.get("x-media-actor")) || null;
  const durationSeconds = readDuration(request.headers.get("x-media-duration"));
  const size = Number(request.headers.get("content-length") || 0);

  const item = await putOneMediaFile({
    fileName,
    mimeType,
    size,
    actor,
    durationSeconds,
    body: request.body,
  });
  return jsonNoStore({ media: [item], item }, { status: 201 });
}

export function mediaPutErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Failed to upload";
  const status =
    message.includes("Only photos") ||
    message.includes("too large") ||
    message.includes("Empty") ||
    message.includes("Invalid") ||
    message.includes("not found")
      ? 400
      : 500;
  return jsonNoStore({ error: message }, { status });
}
