import { jsonNoStore } from "@/lib/http";
import { MAX_MEDIA_BLOB_BYTES, MAX_SERVERLESS_POST_BYTES } from "@/lib/media-types";
import { canMintBlobClientToken, useBlobStore } from "@/lib/persist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Config only. Media no longer uses handleUpload / client-token handshake. */
export async function GET() {
  return jsonNoStore({
    clientUpload: false,
    mode: null,
    serverUpload: true,
    canMintToken: canMintBlobClientToken(),
    maxBytes: MAX_MEDIA_BLOB_BYTES,
    serverMaxBytes: MAX_SERVERLESS_POST_BYTES,
    blob: useBlobStore(),
    vercel: Boolean(process.env.VERCEL),
  });
}

export async function POST() {
  return jsonNoStore(
    {
      error: "This upload handshake is retired. POST the file to /api/media.",
    },
    { status: 410 }
  );
}
