import { MAX_ATTACHMENT_BYTES } from "@/lib/attachments";
import { jsonNoStore } from "@/lib/http";
import { addMediaItem, listMedia } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const media = await listMedia();
    return jsonNoStore({ media });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load media";
    return jsonNoStore({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const actor = String(form.get("actor") ?? "") || null;
    const files = form
      .getAll("files")
      .concat(form.getAll("file"))
      .filter((item): item is File => typeof File !== "undefined" && item instanceof File);

    if (!files.length) {
      return jsonNoStore({ error: "Choose a photo or PDF to upload" }, { status: 400 });
    }

    const items = [];
    for (const file of files) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        return jsonNoStore(
          { error: `${file.name} is too large (max 12 MB)` },
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
        })
      );
    }

    return jsonNoStore({ media: items, item: items[items.length - 1] }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload";
    const status =
      message.includes("Only photos") ||
      message.includes("too large") ||
      message.includes("Empty")
        ? 400
        : 500;
    return jsonNoStore({ error: message }, { status });
  }
}
