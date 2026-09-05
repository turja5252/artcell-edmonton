import { NextResponse } from "next/server";

import { readMediaFile, safeDownloadName } from "@/lib/attachments";
import { jsonNoStore } from "@/lib/http";
import { getMediaItem, removeMediaItem } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const item = await getMediaItem(id);
    const bytes = await readMediaFile(item);
    const download = new URL(request.url).searchParams.get("download") === "1";
    const headers = new Headers({
      "Content-Type": item.mimeType,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeDownloadName(item.fileName)}"`,
    });
    return new NextResponse(new Uint8Array(bytes), { status: 200, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to download";
    const status = message.includes("not found") ? 404 : 500;
    return jsonNoStore({ error: message }, { status });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    try {
      await request.json();
    } catch {
      // actor is optional
    }
    await removeMediaItem(id);
    return jsonNoStore({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete file";
    const status = message.includes("not found") ? 404 : 500;
    return jsonNoStore({ error: message }, { status });
  }
}
