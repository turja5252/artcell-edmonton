import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import {
  assertAllowedMedia,
  ensureMediaFileName,
  MAX_MEDIA_BLOB_BYTES,
  MAX_MEDIA_SERVER_BYTES,
  MEDIA_ALLOWED_CONTENT_TYPES,
  MEDIA_BLOB_PATH_RE,
  MEDIA_ID_RE,
  mediaBlobPathname,
} from "@/lib/media-types";
import { jsonNoStore } from "@/lib/http";
import { useBlobStore } from "@/lib/persist";
import { registerBlobMediaItem } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const clientUpload = useBlobStore();
  return jsonNoStore({
    clientUpload,
    maxBytes: clientUpload ? MAX_MEDIA_BLOB_BYTES : MAX_MEDIA_SERVER_BYTES,
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

export async function POST(request: Request) {
  if (!useBlobStore()) {
    return jsonNoStore(
      { error: "Direct blob upload is not available on this host" },
      { status: 501 }
    );
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return jsonNoStore({ error: "Invalid upload request" }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = parsePayload(clientPayload);
        const fileName = payload.fileName || "upload";
        const mimeType = payload.mimeType || "";
        const size = Number(payload.size) || 0;
        const resolved = assertAllowedMedia(fileName, mimeType, size, MAX_MEDIA_BLOB_BYTES);
        const id = payload.id || "";
        if (!MEDIA_ID_RE.test(id)) throw new Error("Invalid media id");
        const expected = mediaBlobPathname(id, ensureMediaFileName(fileName, resolved), resolved);
        if (pathname !== expected || !MEDIA_BLOB_PATH_RE.test(pathname)) {
          throw new Error("Invalid upload path");
        }
        return {
          allowedContentTypes: MEDIA_ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_MEDIA_BLOB_BYTES,
          addRandomSuffix: false,
          allowOverwrite: true,
          cacheControlMaxAge: 60 * 60 * 24 * 30,
          tokenPayload: JSON.stringify({
            id,
            fileName: ensureMediaFileName(fileName, resolved),
            mimeType: resolved,
            size,
            actor: payload.actor ?? null,
            durationSeconds: payload.durationSeconds ?? null,
          }),
        };
      },
      onUploadCompleted: async ({ tokenPayload }) => {
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
      },
    });
    return jsonNoStore(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start upload";
    const status =
      message.includes("Only photos") ||
      message.includes("too large") ||
      message.includes("Empty") ||
      message.includes("Invalid")
        ? 400
        : 500;
    return jsonNoStore({ error: message }, { status });
  }
}
