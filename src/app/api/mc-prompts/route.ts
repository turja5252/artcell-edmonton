import { jsonNoStore } from "@/lib/http";
import { getMcPrompts, patchMcPrompt } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const mcPrompts = await getMcPrompts();
    return jsonNoStore({ mcPrompts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load prompts";
    return jsonNoStore({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      title?: string;
      script?: string;
      scriptBn?: string;
      note?: string;
      reset?: boolean;
      actor?: string | null;
    };
    const id = body.id?.trim() || "";
    if (!id) {
      return jsonNoStore({ error: "Pick a cue to edit" }, { status: 400 });
    }
    const mcPrompts = await patchMcPrompt({
      id,
      title: body.title,
      script: body.script,
      scriptBn: body.scriptBn,
      note: body.note,
      reset: Boolean(body.reset),
      actor: body.actor,
    });
    return jsonNoStore({ mcPrompts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save prompt";
    const status = message.includes("not on the night") ? 404 : 500;
    return jsonNoStore({ error: message }, { status });
  }
}
