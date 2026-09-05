import { ConcertApp } from "@/components/concert-app";
import { getBoard } from "@/lib/store";
import type { Deliverable, Guest, Lead, Member, Settings } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  let leads: Lead[] = [];
  let guests: Guest[] = [];
  let members: Member[] = [];
  let deliverables: Deliverable[] = [];
  let settings: Settings = {
    moneyTarget: 0,
    attendanceTarget: 0,
    ticketsSold: 0,
    ticketsSoldUpdatedAt: null,
    ticketsSoldUpdatedBy: null,
  };
  let loadError = "";
  try {
    const board = await getBoard();
    leads = board.leads;
    guests = board.guests;
    members = board.members;
    settings = board.settings;
    deliverables = board.deliverables;
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Could not load the board";
  }
  return (
    <ConcertApp
      initialLeads={leads}
      initialGuests={guests}
      initialMembers={members}
      initialSettings={settings}
      initialDeliverables={deliverables}
      initialError={loadError}
    />
  );
}
