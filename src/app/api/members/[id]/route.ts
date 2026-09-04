import { NextResponse } from "next/server";

import { deleteMember, patchMember } from "@/lib/store";
import type { MemberPatch } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as MemberPatch;
    const member = await patchMember(id, body);
    return NextResponse.json({ member });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update";
    const status = message.includes("not found")
      ? 404
      : message.includes("already") || message.includes("Only Tanzim")
        ? message.includes("Only Tanzim")
          ? 403
          : 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    let actor: string | null = null;
    try {
      const body = (await request.json()) as { actor?: string | null };
      actor = body.actor ?? null;
    } catch {
      actor = null;
    }
    const result = await deleteMember(id, actor);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove";
    const status = message.includes("not found")
      ? 404
      : message.includes("Only Tanzim")
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
