import { ConcertApp } from "@/components/concert-app";
import { getBoard } from "@/lib/store";
import type { Guest, Lead, Settings } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  let leads: Lead[] = [];
  let guests: Guest[] = [];
  let settings: Settings = { moneyTarget: 0, attendanceTarget: 0 };
  let loadError = "";
  try {
    const board = await getBoard();
    leads = board.leads;
    guests = board.guests;
    settings = board.settings;
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Could not load the board";
  }
  return (
    <ConcertApp
      initialLeads={leads}
      initialGuests={guests}
      initialSettings={settings}
      initialError={loadError}
    />
  );
}
