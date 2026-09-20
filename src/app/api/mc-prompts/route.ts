import { jsonNoStore } from "@/lib/http";
import { isMcSpeaker } from "@/lib/show-mc";
import { getMcPrompts, patchMcPrompt } from "@/lib/store";
import type { McPromptPatch } from "@/lib/types";

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
    const body = (await request.json()) as McPromptPatch;
    const id = body.id?.trim() || "";
    const chapterId = body.chapterId?.trim() || "";
    if (!id && !chapterId) {
      return jsonNoStore({ error: "Pick a cue to edit" }, { status: 400 });
    }
    if (body.speaker !== undefined && !isMcSpeaker(body.speaker)) {
      return jsonNoStore({ error: "Pick TN, RS, or both" }, { status: 400 });
    }
    const mcPrompts = await patchMcPrompt({
      id: id || undefined,
      title: body.title,
      script: body.script,
      scriptBn: body.scriptBn,
      note: body.note,
      speaker: body.speaker,
      reset: Boolean(body.reset),
      chapterId: chapterId || undefined,
      order: body.order,
      resetOrder: Boolean(body.resetOrder),
      actor: body.actor,
    });
    return jsonNoStore({ mcPrompts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save prompt";
    const status =
      message.includes("not on the night")
        ? 404
        : message.includes("Pick")
          ? 400
          : 500;
    return jsonNoStore({ error: message }, { status });
  }
}
