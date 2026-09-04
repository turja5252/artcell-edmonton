import { jsonNoStore } from "@/lib/http";
import { getBoard } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const board = await getBoard();
    return jsonNoStore(board);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load board";
    return jsonNoStore({ error: message }, { status: 500 });
  }
}
