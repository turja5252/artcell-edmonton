import { NextResponse } from "next/server";

import { addLeadAttachment } from "@/lib/store";
import { sponsorAttachmentError } from "@/lib/attachments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const form = await request.formData();
    const actor = String(form.get("actor") ?? "") || null;
    const files = form
      .getAll("files")
      .concat(form.getAll("file"))
      .filter((item): item is File => typeof File !== "undefined" && item instanceof File);

    if (!files.length) {
      return NextResponse.json({ error: "Choose a photo or PDF to upload" }, { status: 400 });
    }

    let lead = null;
    const attachments = [];
    for (const file of files) {
      const blocked = sponsorAttachmentError(file.name, file.type, file.size);
      if (blocked) {
        return NextResponse.json({ error: blocked }, { status: 400 });
      }
      const bytes = Buffer.from(await file.arrayBuffer());
      const result = await addLeadAttachment({
        leadId: id,
        fileName: file.name || "upload",
        mimeType: file.type || "",
        bytes,
        actor,
      });
      lead = result.lead;
      attachments.push(result.attachment);
    }

    return NextResponse.json({ lead, attachments }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload";
    const status = message.includes("not found")
      ? 404
      : message.includes("Only photos") ||
          message.includes("too large") ||
          message.includes("Empty") ||
          message.includes("Videos go")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
