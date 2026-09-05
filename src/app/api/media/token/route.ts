import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";

import { jsonNoStore } from "@/lib/http";
import {
  assertAllowedMedia,
  ensureMediaFileName,
  isAllowedMediaBlobPath,
  MAX_MEDIA_BLOB_BYTES,
  MAX_SERVERLESS_POST_BYTES,
  MEDIA_ALLOWED_CONTENT_TYPES,
  MEDIA_ID_RE,
  mediaBlobPathname,
  newMediaId,
} from "@/lib/media-types";
import { blobReadWriteToken, canMintBlobClientToken, useBlobStore } from "@/lib/persist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mint a Blob client token with `generateClientTokenFromReadWriteToken`.
 * @vercel/blob@2.8.0 exports this from `@vercel/blob/client` (not the root package).
 * Does not use `handleUpload`.
 */
export async function GET() {
  return jsonNoStore({
    canMint: canMintBlobClientToken(),
    mode: canMintBlobClientToken() ? "token" : "presigned",
    blob: useBlobStore(),
    serverMaxBytes: MAX_SERVERLESS_POST_BYTES,
    vercel: Boolean(process.env.VERCEL),
  });
}

type TokenBody = {
  id?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
};

export async function POST(request: Request) {
  const rwToken = blobReadWriteToken();
  if (!rwToken) {
    return jsonNoStore(
      {
        error: "Presigned upload required",
        canMint: false,
        mode: "presigned",
        fallback: "presigned",
      },
      { status: 409 }
    );
  }

  let body: TokenBody;
  try {
    body = (await request.json()) as TokenBody;
  } catch {
    return jsonNoStore({ error: "Invalid token request" }, { status: 400 });
  }

  try {
    const fileName = body.fileName || "upload";
    const mimeType = body.mimeType || "";
    const size = Number(body.size) || 0;
    const resolved = assertAllowedMedia(fileName, mimeType, size, MAX_MEDIA_BLOB_BYTES);
    const id = body.id && MEDIA_ID_RE.test(body.id) ? body.id : newMediaId();
    const storedName = ensureMediaFileName(fileName, resolved);
    const pathname = mediaBlobPathname(id, storedName, resolved);
    if (!isAllowedMediaBlobPath(pathname, id, pathname)) {
      return jsonNoStore({ error: "Invalid upload path" }, { status: 400 });
    }

    const token = await generateClientTokenFromReadWriteToken({
      token: rwToken,
      pathname,
      allowedContentTypes: MEDIA_ALLOWED_CONTENT_TYPES,
      maximumSizeInBytes: MAX_MEDIA_BLOB_BYTES,
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60 * 60 * 24 * 30,
      validUntil: Date.now() + 60 * 60 * 1000,
    });

    return jsonNoStore({
      token,
      id,
      pathname,
      fileName: storedName,
      mimeType: resolved,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not mint upload token";
    const status =
      message.includes("Only photos") ||
      message.includes("too large") ||
      message.includes("Empty") ||
      message.includes("Invalid")
        ? 400
        : 409;
    return jsonNoStore(
      {
        error: "Presigned upload required",
        detail: message,
        canMint: false,
        mode: "presigned",
        fallback: "presigned",
      },
      { status }
    );
  }
}
