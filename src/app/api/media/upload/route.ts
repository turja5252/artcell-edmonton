import { issueSignedToken } from "@vercel/blob";
import {
  handleUpload,
  handleUploadPresigned,
  type HandleUploadBody,
  type HandleUploadPresignedBody,
} from "@vercel/blob/client";

import {
  assertAllowedMedia,
  ensureMediaFileName,
  isAllowedMediaBlobPath,
  MAX_MEDIA_BLOB_BYTES,
  MAX_MEDIA_SERVER_BYTES,
  MEDIA_ALLOWED_CONTENT_TYPES,
  MEDIA_ID_RE,
  mediaBlobPathname,
  STORAGE_NOT_CONNECTED,
} from "@/lib/media-types";
import { jsonNoStore } from "@/lib/http";
import { blobClientUploadMode, blobReadWriteToken, useBlobStore } from "@/lib/persist";
import { registerBlobMediaItem } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TOKEN_CONSTRAINTS = {
  allowedContentTypes: MEDIA_ALLOWED_CONTENT_TYPES,
  maximumSizeInBytes: MAX_MEDIA_BLOB_BYTES,
  addRandomSuffix: false,
  allowOverwrite: true,
  cacheControlMaxAge: 60 * 60 * 24 * 30,
} as const;

export async function GET() {
  const mode = blobClientUploadMode();
  return jsonNoStore({
    clientUpload: Boolean(mode),
    mode,
    maxBytes: mode ? MAX_MEDIA_BLOB_BYTES : MAX_MEDIA_SERVER_BYTES,
    vercel: Boolean(process.env.VERCEL),
  });
}

type ClientPayload = {
  id?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  actor?: string | null;
  durationSeconds?: number | null;
};

function parsePayload(raw: string | null | undefined): ClientPayload {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ClientPayload;
  } catch {
    return {};
  }
}

function authorizeClientUpload(pathname: string, clientPayload: string | null) {
  const payload = parsePayload(clientPayload);
  const fileName = payload.fileName || "upload";
  const mimeType = payload.mimeType || "";
  const size = Number(payload.size) || 0;
  const resolved = assertAllowedMedia(fileName, mimeType, size, MAX_MEDIA_BLOB_BYTES);
  const id = payload.id || "";
  if (!MEDIA_ID_RE.test(id)) throw new Error("Invalid media id");
  const storedName = ensureMediaFileName(fileName, resolved);
  const expected = mediaBlobPathname(id, storedName, resolved);
  if (!isAllowedMediaBlobPath(pathname, id, expected)) {
    throw new Error("Invalid upload path");
  }
  return {
    id,
    fileName: storedName,
    mimeType: resolved,
    size,
    actor: payload.actor ?? null,
    durationSeconds: payload.durationSeconds ?? null,
  };
}

async function registerCompleted(tokenPayload: string | null | undefined) {
  try {
    const payload = parsePayload(tokenPayload);
    if (!payload.id || !payload.fileName) return;
    await registerBlobMediaItem({
      id: payload.id,
      fileName: payload.fileName,
      mimeType: payload.mimeType || "",
      size: Number(payload.size) || 0,
      actor: payload.actor,
      durationSeconds: payload.durationSeconds,
    });
  } catch {
    // Client registers the file next; do not fail the completed upload.
  }
}

function uploadErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Failed to start upload";
  if (
    /No read-write token|No blob credentials|OIDC|not available on this host/i.test(message)
  ) {
    return jsonNoStore({ error: STORAGE_NOT_CONNECTED }, { status: 503 });
  }
  const status =
    message.includes("Only photos") ||
    message.includes("too large") ||
    message.includes("Empty") ||
    message.includes("Invalid")
      ? 400
      : 500;
  return jsonNoStore({ error: message }, { status });
}

export async function POST(request: Request) {
  if (!useBlobStore()) {
    return jsonNoStore({ error: STORAGE_NOT_CONNECTED }, { status: 503 });
  }

  let body: { type?: string };
  try {
    body = (await request.json()) as { type?: string };
  } catch {
    return jsonNoStore({ error: "Invalid upload request" }, { status: 400 });
  }

  try {
    if (body.type === "blob.generate-presigned-url") {
      const jsonResponse = await handleUploadPresigned({
        body: body as HandleUploadPresignedBody,
        request,
        webhookPublicKey: process.env.BLOB_WEBHOOK_PUBLIC_KEY || "unused",
        getSignedToken: async (pathname, clientPayload) => {
          const authorized = authorizeClientUpload(pathname, clientPayload);
          const token = await issueSignedToken({
            pathname,
            operations: ["put"],
            validUntil: Date.now() + 60 * 60 * 1000,
            allowedContentTypes: MEDIA_ALLOWED_CONTENT_TYPES,
            maximumSizeInBytes: MAX_MEDIA_BLOB_BYTES,
          });
          return {
            token,
            urlOptions: {
              ...TOKEN_CONSTRAINTS,
              tokenPayload: JSON.stringify(authorized),
            },
          };
        },
      });
      return jsonNoStore(jsonResponse);
    }

    if (body.type === "blob.generate-client-token") {
      const rwToken = blobReadWriteToken();
      if (!rwToken) {
        // OIDC can write via put()/issueSignedToken, but cannot HMAC a classic client token.
        return jsonNoStore({ error: STORAGE_NOT_CONNECTED, mode: "presigned" }, { status: 409 });
      }
      const jsonResponse = await handleUpload({
        token: rwToken,
        body: body as HandleUploadBody,
        request,
        onBeforeGenerateToken: async (pathname, clientPayload) => {
          const authorized = authorizeClientUpload(pathname, clientPayload);
          return {
            ...TOKEN_CONSTRAINTS,
            tokenPayload: JSON.stringify(authorized),
          };
        },
        onUploadCompleted: async ({ tokenPayload }) => {
          await registerCompleted(tokenPayload);
        },
      });
      return jsonNoStore(jsonResponse);
    }

    if (body.type === "blob.upload-completed") {
      const rwToken = blobReadWriteToken();
      if (rwToken) {
        const jsonResponse = await handleUpload({
          token: rwToken,
          body: body as HandleUploadBody,
          request,
          onBeforeGenerateToken: async () => TOKEN_CONSTRAINTS,
          onUploadCompleted: async ({ tokenPayload }) => {
            await registerCompleted(tokenPayload);
          },
        });
        return jsonNoStore(jsonResponse);
      }
      return jsonNoStore({ type: "blob.upload-completed", response: "ok" });
    }

    return jsonNoStore({ error: "Invalid upload request" }, { status: 400 });
  } catch (error) {
    return uploadErrorResponse(error);
  }
}
