import { jsonNoStore } from "@/lib/http";
import { createDeliverable, listDeliverables } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const deliverables = await listDeliverables();
    return jsonNoStore({ deliverables });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load tasks";
    return jsonNoStore({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      title?: string;
      assignedTo?: string;
      dueDate?: string;
      startDate?: string | null;
      notes?: string;
      actor?: string | null;
    };
    const item = await createDeliverable({
      title: body.title ?? "",
      assignedTo: body.assignedTo ?? "",
      dueDate: body.dueDate ?? "",
      startDate: body.startDate,
      notes: body.notes,
      actor: body.actor,
    });
    return jsonNoStore({ deliverable: item }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add task";
    const status =
      message.includes("title") ||
      message.includes("due date") ||
      message.includes("owns this") ||
      message.includes("Admin cannot") ||
      message.includes("Start date")
        ? 400
        : 500;
    return jsonNoStore({ error: message }, { status });
  }
}
