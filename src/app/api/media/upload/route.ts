import { issueSignedToken } from "@vercel/blob";
import {
  generateClientTokenFromReadWriteToken,
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
  MAX_SERVERLESS_POST_BYTES,
  MEDIA_ALLOWED_CONTENT_TYPES,
  MEDIA_ID_RE,
  mediaBlobPathname,
} from "@/lib/media-types";
import { jsonNoStore } from "@/lib/http";
import { mediaPutErrorResponse, putMediaFromRequest } from "@/lib/media-server-put";
import {
  blobClientUploadMode,
  blobReadWriteToken,
  canMintBlobClientToken,
  useBlobStore,
} from "@/lib/persist";
import { registerBlobMediaItem } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
    serverUpload: true,
    canMintToken: canMintBlobClientToken(),
    maxBytes: mode ? MAX_MEDIA_BLOB_BYTES : MAX_MEDIA_SERVER_BYTES,
    serverMaxBytes: MAX_SERVERLESS_POST_BYTES,
    blob: useBlobStore(),
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
  const status =
    message.includes("Only photos") ||
    message.includes("too large") ||
    message.includes("Empty") ||
    message.includes("Invalid")
      ? 400
      : 409;
  return jsonNoStore(
    { error: message, fallback: "presigned", mode: blobClientUploadMode() },
    { status }
  );
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    try {
      return await putMediaFromRequest(request);
    } catch (error) {
      return mediaPutErrorResponse(error);
    }
  }

  if (!useBlobStore()) {
    return jsonNoStore({ error: "Storage not connected", fallback: "server" }, { status: 503 });
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
        return jsonNoStore(
          { error: "Presigned upload required", fallback: "presigned", mode: "presigned" },
          { status: 409 }
        );
      }
      const event = body as Extract<HandleUploadBody, { type: "blob.generate-client-token" }>;
      const pathname = event.payload.pathname;
      authorizeClientUpload(pathname, event.payload.clientPayload);
      const clientToken = await generateClientTokenFromReadWriteToken({
        token: rwToken,
        pathname,
        ...TOKEN_CONSTRAINTS,
        validUntil: Date.now() + 60 * 60 * 1000,
      });
      return jsonNoStore({
        type: "blob.generate-client-token",
        clientToken,
      });
    }

    if (body.type === "blob.upload-completed") {
      const completed = body as { payload?: { tokenPayload?: string } };
      await registerCompleted(completed.payload?.tokenPayload);
      return jsonNoStore({ type: "blob.upload-completed", response: "ok" });
    }

    return jsonNoStore({ error: "Invalid upload request", fallback: "server" }, { status: 400 });
  } catch (error) {
    return uploadErrorResponse(error);
  }
}
