import { jsonNoStore } from "@/lib/http";
import { deleteLead, patchLead } from "@/lib/store";
import type { LeadPatch } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as LeadPatch;
    const lead = await patchLead(id, body);
    return jsonNoStore({ lead });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update";
    const status = message.includes("not found") ? 404 : 500;
    return jsonNoStore({ error: message }, { status });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await deleteLead(id);
    return jsonNoStore({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete";
    const status = message.includes("not found") ? 404 : 500;
    return jsonNoStore({ error: message }, { status });
  }
}
