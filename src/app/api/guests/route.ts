import { NextResponse } from "next/server";

import { createGuest, listGuests } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const guests = await listGuests();
    return NextResponse.json({ guests });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load guests";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      email?: string;
      assignedTo?: string | null;
      partySize?: number;
      actor?: string | null;
    };
    const guest = await createGuest({
      name: body.name ?? "",
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
      email: body.email,
      assignedTo: body.assignedTo,
      partySize: body.partySize,
      actor: body.actor,
    });
    return NextResponse.json({ guest }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add guest";
    const status = message.includes("required") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
