import { NextResponse } from "next/server";

import { patchGuest } from "@/lib/store";
import type { GuestPatch } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as GuestPatch;
    const guest = await patchGuest(id, body);
    return NextResponse.json({ guest });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
