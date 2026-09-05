import { jsonNoStore } from "@/lib/http";
import { mediaPutErrorResponse, putMediaFromRequest } from "@/lib/media-server-put";
import { listMedia, registerBlobMediaItem } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  try {
    const media = await listMedia();
    return jsonNoStore({ media });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load media";
    return jsonNoStore({ error: message }, { status: 500 });
  }
}

type RegisterBody = {
  id?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  durationSeconds?: number | null;
  actor?: string | null;
};

async function registerFromJson(request: Request) {
  const body = (await request.json()) as RegisterBody;
  const item = await registerBlobMediaItem({
    id: String(body.id || ""),
    fileName: body.fileName || "upload",
    mimeType: body.mimeType || "",
    size: Number(body.size) || 0,
    actor: body.actor ?? null,
    durationSeconds: body.durationSeconds,
  });
  return jsonNoStore({ media: [item], item }, { status: 201 });
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await registerFromJson(request);
    }
    return await putMediaFromRequest(request);
  } catch (error) {
    return mediaPutErrorResponse(error);
  }
}
