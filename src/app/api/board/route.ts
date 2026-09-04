import { NextResponse } from "next/server";

import { getBoard } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const board = await getBoard();
    return NextResponse.json(board);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load board";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
