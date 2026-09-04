import { ConcertApp } from "@/components/concert-app";
import { listLeads } from "@/lib/store";
import type { Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  let leads: Lead[] = [];
  let loadError = "";
  try {
    leads = await listLeads();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Could not load the board";
  }
  return <ConcertApp initialLeads={leads} initialError={loadError} />;
}
