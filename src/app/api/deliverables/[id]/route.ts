import { jsonNoStore } from "@/lib/http";
import { deleteDeliverable, patchDeliverable } from "@/lib/store";
import type { DeliverablePatch } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as DeliverablePatch;
    const deliverable = await patchDeliverable(id, body);
    return jsonNoStore({ deliverable });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update";
    const status = message.includes("not found")
      ? 404
      : message.includes("title") ||
          message.includes("due date") ||
          message.includes("owns this") ||
          message.includes("Admin cannot") ||
          message.includes("Start date")
        ? 400
        : 500;
    return jsonNoStore({ error: message }, { status });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await deleteDeliverable(id);
    return jsonNoStore({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete";
    const status = message.includes("not found") ? 404 : 500;
    return jsonNoStore({ error: message }, { status });
  }
}
