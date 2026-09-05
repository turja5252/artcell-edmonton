import { MAX_MEDIA_SERVER_BYTES } from "@/lib/attachments";
import { jsonNoStore } from "@/lib/http";
import { addMediaItem, listMedia, registerBlobMediaItem } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

async function uploadFromForm(request: Request) {
  const form = await request.formData();
  const actor = String(form.get("actor") ?? "") || null;
  const durationRaw = form.get("durationSeconds");
  const durationSeconds =
    durationRaw !== null && Number.isFinite(Number(durationRaw)) ? Number(durationRaw) : null;
  const files = form
    .getAll("files")
    .concat(form.getAll("file"))
    .filter((item): item is File => typeof File !== "undefined" && item instanceof File);

  if (!files.length) {
    return jsonNoStore({ error: "Choose a photo, video, or PDF to upload" }, { status: 400 });
  }

  const items = [];
  for (const file of files) {
    if (file.size > MAX_MEDIA_SERVER_BYTES) {
      return jsonNoStore(
        { error: `${file.name} is too large (max 80 MB)` },
        { status: 400 }
      );
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    items.push(
      await addMediaItem({
        fileName: file.name || "upload",
        mimeType: file.type || "",
        bytes,
        actor,
        durationSeconds,
      })
    );
  }

  return jsonNoStore({ media: items, item: items[items.length - 1] }, { status: 201 });
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await registerFromJson(request);
    }
    return await uploadFromForm(request);
  } catch (error) {
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
}
