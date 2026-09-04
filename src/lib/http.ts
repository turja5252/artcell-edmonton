import { NextResponse } from "next/server";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
} as const;

export function jsonNoStore(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    status: init?.status,
    headers: NO_STORE,
  });
}
