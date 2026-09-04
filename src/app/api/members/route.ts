import { NextResponse } from "next/server";

import { createMember, listMembers } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const members = await listMembers();
    return NextResponse.json({ members });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load members";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      phone?: string;
      email?: string;
      actor?: string | null;
    };
    const member = await createMember({
      name: body.name ?? "",
      phone: body.phone,
      email: body.email,
      actor: body.actor,
    });
    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add member";
    const status = message.includes("required")
      ? 400
      : message.includes("Only Admin") || message.includes("reserved")
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
