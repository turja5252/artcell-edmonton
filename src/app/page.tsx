import { ConcertApp } from "@/components/concert-app";
import { DEFAULT_CONCERT_DATE } from "@/lib/concert-date";
import { EMPTY_MC_PROMPTS } from "@/lib/show-mc";
import { DEFAULT_TICKET_URL } from "@/lib/tickets";
import { getBoard } from "@/lib/store";
import type { Deliverable, Guest, Lead, MediaItem, McPromptStore, Member, Settings } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  let leads: Lead[] = [];
  let guests: Guest[] = [];
  let members: Member[] = [];
  let deliverables: Deliverable[] = [];
  let media: MediaItem[] = [];
  let mcPrompts: McPromptStore = EMPTY_MC_PROMPTS;
  let settings: Settings = {
    moneyTarget: 0,
    attendanceTarget: 0,
    ticketsSold: 0,
    ticketsSoldUpdatedAt: null,
    ticketsSoldUpdatedBy: null,
    ticketUrl: DEFAULT_TICKET_URL,
    concertDate: DEFAULT_CONCERT_DATE,
  };
  let loadError = "";
  try {
    const board = await getBoard();
    leads = board.leads;
    guests = board.guests;
    members = board.members;
    settings = board.settings;
    deliverables = board.deliverables;
    media = board.media ?? [];
    mcPrompts = board.mcPrompts ?? EMPTY_MC_PROMPTS;
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
      initialMedia={media}
      initialMcPrompts={mcPrompts}
      initialError={loadError}
    />
  );
}
