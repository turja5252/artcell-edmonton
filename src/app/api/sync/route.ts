import { NextResponse } from "next/server";

import { fetchSheetRows } from "@/lib/sheet";
import { mergeSheetRows } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      actor?: string | null;
    };
    const rows = await fetchSheetRows();
    const { leads, added } = await mergeSheetRows(rows, body.actor);
    return NextResponse.json({ leads, added });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
