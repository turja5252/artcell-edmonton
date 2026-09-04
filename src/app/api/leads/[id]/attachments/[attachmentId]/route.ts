import { NextResponse } from "next/server";

import { getLeadAttachment, removeLeadAttachment } from "@/lib/store";
import { readAttachmentFile, safeDownloadName } from "@/lib/attachments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const { id, attachmentId } = await context.params;
    const { attachment } = await getLeadAttachment(id, attachmentId);
    const bytes = await readAttachmentFile(id, attachment);
    const download = new URL(request.url).searchParams.get("download") === "1";
    const headers = new Headers({
      "Content-Type": attachment.mimeType,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeDownloadName(attachment.fileName)}"`,
    });
    return new NextResponse(new Uint8Array(bytes), { status: 200, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to download";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const { id, attachmentId } = await context.params;
    let actor: string | null = null;
    try {
      const body = (await request.json()) as { actor?: string | null };
      actor = body.actor ?? null;
    } catch {
      actor = null;
    }
    const lead = await removeLeadAttachment(id, attachmentId, actor);
    return NextResponse.json({ lead });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete file";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
