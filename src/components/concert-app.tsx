"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  Check,
  FileSpreadsheet,
  Handshake,
  ListMusic,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";

import { AddGuest, type AddGuestInput } from "@/components/add-guest";
import { AddLead } from "@/components/add-lead";
import { GuestEditor } from "@/components/guest-editor";
import { LeadEditor } from "@/components/lead-editor";
import { MoneyBoard } from "@/components/money-board";
import { PersonChip } from "@/components/person-chip";
import { SeatsBoard, type SeatFilter } from "@/components/seats-board";
import { SetlistBoard } from "@/components/setlist-board";
import { TargetEditor } from "@/components/target-editor";
import { TeamBoard } from "@/components/team-board";
import { WhoAmI } from "@/components/who-am-i";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/money";
import { formatTime, uniquePeople } from "@/lib/people";
import type { Guest, GuestStatus, Lead, Member, Settings } from "@/lib/types";
import { displayGuestName } from "@/lib/types";
import { cn } from "@/lib/utils";

const ME_KEY = "artcell-edmonton-me";
const ME_EVENT = "artcell-me";

function subscribeMe(onChange: () => void) {
  window.addEventListener(ME_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(ME_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readMe() {
  return window.localStorage.getItem(ME_KEY) ?? "";
}

function writeMe(name: string) {
  window.localStorage.setItem(ME_KEY, name);
  window.dispatchEvent(new Event(ME_EVENT));
}

type Tab = "outreach" | "money" | "seats" | "team" | "setlist";
type Filter = "mine" | "open" | "unassigned" | "done" | "all";

function matches(lead: Lead, query: string, filter: Filter, me: string) {
  const haystack = `${lead.company} ${lead.assignedTo ?? ""} ${lead.outcome}`.toLowerCase();
  if (query && !haystack.includes(query.toLowerCase())) return false;
  if (filter === "mine") return Boolean(me) && lead.assignedTo === me;
  if (filter === "open") return !lead.done;
  if (filter === "unassigned") return !lead.assignedTo && !lead.done;
  if (filter === "done") return lead.done;
  return true;
}

export function ConcertApp({
  initialLeads,
  initialGuests,
  initialMembers,
  initialSettings,
  initialError = "",
}: {
  initialLeads: Lead[];
  initialGuests: Guest[];
  initialMembers: Member[];
  initialSettings: Settings;
  initialError?: string;
}) {
  const me = useSyncExternalStore(subscribeMe, readMe, () => "");
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [guests, setGuests] = useState<Guest[]>(initialGuests);
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [tab, setTab] = useState<Tab>("outreach");
  const [filter, setFilter] = useState<Filter>("open");
  const [seatFilter, setSeatFilter] = useState<SeatFilter>("not_called");
  const [query, setQuery] = useState("");
  const [error, setError] = useState(initialError);
  const [whoForced, setWhoForced] = useState(false);
  const [whoSkipped, setWhoSkipped] = useState(false);
  const whoOpen = whoForced || (hydrated && !me && !whoSkipped);
  const [addOpen, setAddOpen] = useState(false);
  const [addGuestOpen, setAddGuestOpen] = useState(false);
  const [active, setActive] = useState<Lead | null>(null);
  const [activeGuest, setActiveGuest] = useState<Guest | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [targetKind, setTargetKind] = useState<"money" | "seats" | null>(null);

  const people = useMemo(() => {
    const names = new Set(members.map((member) => member.name));
    for (const name of uniquePeople(leads, guests)) names.add(name);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [members, leads, guests]);

  const load = useCallback(async () => {
    const response = await fetch("/api/board", { cache: "no-store" });
    const data = (await response.json()) as {
      leads?: Lead[];
      guests?: Guest[];
      members?: Member[];
      settings?: Settings;
      error?: string;
    };
    if (!response.ok) throw new Error(data.error || "Could not load the board");
    if (data.leads) setLeads(data.leads);
    if (data.guests) setGuests(data.guests);
    if (data.members) setMembers(data.members);
    if (data.settings) setSettings(data.settings);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void load().catch(() => undefined);
    }, 15000);
    const onFocus = () => void load().catch(() => undefined);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function pickMe(name: string) {
    writeMe(name);
    setWhoForced(false);
    setWhoSkipped(false);
    setFilter("mine");
  }

  async function ensureMember(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (members.some((member) => member.name.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }
    const response = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    const data = (await response.json()) as { member?: Member; error?: string };
    if (!response.ok) throw new Error(data.error || "Could not add member");
    if (data.member) {
      setMembers((current) => {
        if (current.some((member) => member.id === data.member!.id)) return current;
        return [...current, data.member!].sort((a, b) => a.name.localeCompare(b.name));
      });
    }
  }

  async function pickMeAndJoin(name: string) {
    await ensureMember(name);
    pickMe(name);
    setToast(`${name} is on the team`);
  }

  async function addMember(input: { name: string; phone?: string; email?: string }) {
    const response = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = (await response.json()) as { member?: Member; error?: string };
    if (!response.ok) throw new Error(data.error || "Could not add member");
    if (data.member) {
      setMembers((current) => {
        if (current.some((member) => member.id === data.member!.id)) return current;
        return [...current, data.member!].sort((a, b) => a.name.localeCompare(b.name));
      });
      setToast(`${data.member.name} joined the team`);
    }
  }

  async function removeMember(id: string) {
    const response = await fetch(`/api/members/${id}`, { method: "DELETE" });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(data.error || "Could not remove member");
    setMembers((current) => current.filter((member) => member.id !== id));
    setToast("Removed from the team");
  }

  function setWhoOpen(open: boolean) {
    if (open) {
      setWhoSkipped(false);
      setWhoForced(true);
      return;
    }
    setWhoForced(false);
    if (!me) setWhoSkipped(true);
  }

  async function saveLead(id: string, patch: Partial<Lead> & { actor?: string }) {
    setBusyId(id);
    setLeads((current) =>
      current.map((lead) =>
        lead.id === id
          ? {
              ...lead,
              ...patch,
              assignedTo:
                patch.assignedTo === undefined ? lead.assignedTo : patch.assignedTo,
              updatedAt: new Date().toISOString(),
              updatedBy: patch.actor ?? me ?? lead.updatedBy,
            }
          : lead
      )
    );
    setActive((current) =>
      current && current.id === id
        ? {
            ...current,
            ...patch,
            assignedTo:
              patch.assignedTo === undefined ? current.assignedTo : patch.assignedTo,
          }
        : current
    );
    try {
      const response = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...patch, actor: patch.actor ?? me }),
      });
      const data = (await response.json()) as { lead?: Lead; error?: string };
      if (!response.ok) throw new Error(data.error || "Update failed");
      if (data.lead) {
        setLeads((current) =>
          current.map((lead) => (lead.id === id ? data.lead! : lead))
        );
        setActive((current) => (current?.id === id ? data.lead! : current));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function deleteLead(id: string) {
    const removed = leads.find((lead) => lead.id === id);
    setLeads((current) => current.filter((lead) => lead.id !== id));
    setActive(null);
    try {
      const response = await fetch(`/api/leads/${id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not delete");
      setToast(removed ? `Removed ${removed.company}` : "Entry deleted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
      await load();
    }
  }

  async function addLead(company: string, assignedTo: string | null) {
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company, assignedTo, actor: me }),
    });
    const data = (await response.json()) as { lead?: Lead; error?: string };
    if (!response.ok) throw new Error(data.error || "Could not add");
    if (data.lead) setLeads((current) => [...current, data.lead!]);
    setToast(`${company} is on the board`);
  }

  async function saveGuest(id: string, patch: Partial<Guest> & { actor?: string }) {
    setBusyId(id);
    setGuests((current) =>
      current.map((guest) =>
        guest.id === id
          ? {
              ...guest,
              ...patch,
              assignedTo:
                patch.assignedTo === undefined ? guest.assignedTo : patch.assignedTo,
              updatedAt: new Date().toISOString(),
              updatedBy: patch.actor ?? me ?? guest.updatedBy,
            }
          : guest
      )
    );
    setActiveGuest((current) =>
      current && current.id === id
        ? {
            ...current,
            ...patch,
            assignedTo:
              patch.assignedTo === undefined ? current.assignedTo : patch.assignedTo,
          }
        : current
    );
    try {
      const response = await fetch(`/api/guests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...patch, actor: patch.actor ?? me }),
      });
      const data = (await response.json()) as { guest?: Guest; error?: string };
      if (!response.ok) throw new Error(data.error || "Update failed");
      if (data.guest) {
        setGuests((current) =>
          current.map((guest) => (guest.id === id ? data.guest! : guest))
        );
        setActiveGuest((current) => (current?.id === id ? data.guest! : current));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function addGuest(input: AddGuestInput) {
    const response = await fetch("/api/guests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, actor: me }),
    });
    const data = (await response.json()) as { guest?: Guest; error?: string };
    if (!response.ok) throw new Error(data.error || "Could not add");
    if (data.guest) setGuests((current) => [...current, data.guest!]);
    setToast(`${displayGuestName(data.guest ?? input)} is on the call list`);
  }

  async function saveSettings(patch: Partial<Settings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...patch, actor: me }),
    });
    const data = (await response.json()) as { settings?: Settings; error?: string };
    if (!response.ok) throw new Error(data.error || "Could not save target");
    if (data.settings) setSettings(data.settings);
    setToast("Target saved");
  }

  async function syncSheet() {
    setSyncing(true);
    setError("");
    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor: me }),
      });
      const data = (await response.json()) as {
        leads?: Lead[];
        added?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || "Sync failed");
      if (data.leads) setLeads(data.leads);
      setToast(
        data.added ? `Added ${data.added} new name${data.added === 1 ? "" : "s"} from the sheet` : "Sheet is already in sync"
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function shareBoard() {
    const url = window.location.href;
    const text = "Artcell Edmonton outreach board — tap your name and update as you call.";
    try {
      if (navigator.share) {
        await navigator.share({ title: "Artcell Edmonton Show", text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setToast("Link copied — send it in the group chat");
    } catch {
      setToast("Copy the URL from the address bar");
    }
  }

  const doneCount = leads.filter((lead) => lead.done).length;
  const openCount = leads.length - doneCount;
  const unassignedCount = leads.filter((lead) => !lead.assignedTo && !lead.done).length;
  const myOpen = leads.filter((lead) => lead.assignedTo === me && !lead.done).length;

  const visible = leads
    .filter((lead) => matches(lead, query, filter, me))
    .sort((a, b) => Number(a.done) - Number(b.done) || a.company.localeCompare(b.company));

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "mine", label: me ? `${me.split(" ")[0]}` : "Mine", count: me ? leads.filter((l) => l.assignedTo === me).length : 0 },
    { id: "open", label: "Open", count: openCount },
    { id: "unassigned", label: "Need owner", count: unassignedCount },
    { id: "done", label: "Done", count: doneCount },
    { id: "all", label: "All", count: leads.length },
  ];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 pb-32 pt-5 sm:px-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.22em] text-primary uppercase">
            Edmonton show
          </p>
          <h1 className="font-heading text-4xl leading-none tracking-wide sm:text-5xl">
            Artcell
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Calls, money, seats — tap to update from your phone.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            className="size-11"
            render={<a href="/Artcell-Edmonton-Show.xlsx" download />}
            aria-label="Download Excel for Microsoft 365"
          >
            <FileSpreadsheet />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            className="size-11"
            onClick={() => void shareBoard()}
            aria-label="Share this board"
          >
            <Share2 />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            className="size-11"
            onClick={() => void syncSheet()}
            disabled={syncing}
            aria-label="Pull new names from the Google Sheet"
          >
            <RefreshCw className={cn(syncing && "animate-spin")} />
          </Button>
        </div>
      </header>

      <button
        type="button"
        onClick={() => setWhoOpen(true)}
        className="relative z-10 mt-4 flex w-full items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card/70 px-3 py-3 text-left active:bg-card"
      >
        <span className="text-sm text-muted-foreground">Updating as</span>
        {me ? (
          <PersonChip name={me} />
        ) : (
          <span className="text-sm font-medium text-primary">Tap to pick your name</span>
        )}
      </button>

      {tab === "outreach" ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="Reached" value={`${doneCount}/${leads.length || "—"}`} />
          <Stat label="Still open" value={String(openCount)} />
          <Stat label={me ? "Your open" : "Need owner"} value={String(me ? myOpen : unassignedCount)} />
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
          <Button
            type="button"
            variant="ghost"
            className="ml-2 h-8"
            onClick={() => {
              setError("");
              void load();
            }}
          >
            Retry
          </Button>
        </div>
      ) : null}

      {tab === "outreach" && (
        <section className="mt-5 flex-1">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search a company or person"
              className="h-12 pl-10 text-base"
            />
          </div>
          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
            {filters.map((item) => (
              <Button
                key={item.id}
                type="button"
                variant={filter === item.id ? "default" : "outline"}
                className="h-10 shrink-0 rounded-full px-3"
                onClick={() => setFilter(item.id)}
              >
                {item.label}
                <span className="tabular-nums opacity-80">{item.count}</span>
              </Button>
            ))}
          </div>

          {visible.length === 0 ? (
            <EmptyState
              filter={filter}
              me={me}
              onAdd={() => setAddOpen(true)}
              onPickMe={() => setWhoOpen(true)}
            />
          ) : (
            <ul className="mt-4 space-y-2">
              {visible.map((lead) => (
                <li key={lead.id}>
                  <LeadCard
                    lead={lead}
                    me={me}
                    busy={busyId === lead.id}
                    onOpen={() => setActive(lead)}
                    onClaim={() => {
                      if (!me) {
                        setWhoOpen(true);
                        return;
                      }
                      void saveLead(lead.id, { assignedTo: me, actor: me });
                      setToast(`You’re on ${lead.company}`);
                    }}
                    onToggleDone={() => {
                      void saveLead(lead.id, { done: !lead.done, actor: me });
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "money" && (
        <section className="mt-5 flex-1">
          <MoneyBoard
            leads={leads}
            target={settings.moneyTarget}
            onSetTarget={() => setTargetKind("money")}
            onOpenLead={(lead) => setActive(lead)}
          />
        </section>
      )}

      {tab === "seats" && (
        <section className="mt-5 flex-1">
          <SeatsBoard
            guests={guests}
            target={settings.attendanceTarget}
            me={me}
            filter={seatFilter}
            onFilter={setSeatFilter}
            onSetTarget={() => setTargetKind("seats")}
            onOpen={(guest) => setActiveGuest(guest)}
            onClaim={(guest) => {
              if (!me) {
                setWhoOpen(true);
                return;
              }
              void saveGuest(guest.id, { assignedTo: me, actor: me });
              setToast(`You’re on ${displayGuestName(guest)}`);
            }}
            onStatus={(guest, status: GuestStatus) => {
              void saveGuest(guest.id, { status, actor: me });
            }}
            onPartySize={(guest, partySize) => {
              void saveGuest(guest.id, { partySize, actor: me });
            }}
          />
        </section>
      )}

      {tab === "team" && (
        <section className="mt-5 flex-1">
          <TeamBoard
            members={members}
            leads={leads}
            guests={guests}
            onFilterPerson={(name) => {
              if (name) {
                writeMe(name);
                setFilter("mine");
              } else {
                setFilter("unassigned");
              }
              setTab("outreach");
            }}
            onAdd={addMember}
            onRemove={removeMember}
          />
        </section>
      )}

      {tab === "setlist" && (
        <section className="mt-5 flex-1">
          <SetlistBoard />
        </section>
      )}

      {tab === "outreach" || tab === "seats" ? (
        <Button
          type="button"
          className="fixed bottom-28 left-4 z-30 size-14 rounded-full shadow-lg sm:left-auto sm:right-[max(1rem,calc(50%-22rem))]"
          onClick={() => (tab === "seats" ? setAddGuestOpen(true) : setAddOpen(true))}
          aria-label={tab === "seats" ? "Add someone to invite" : "Add a company"}
        >
          <Plus className="size-6" />
        </Button>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-background/95 px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md">
        <div className="mx-auto grid max-w-3xl grid-cols-5 gap-0.5">
          <NavButton
            active={tab === "outreach"}
            icon={<Handshake className="size-5" />}
            label="Calls"
            onClick={() => setTab("outreach")}
          />
          <NavButton
            active={tab === "money"}
            icon={<Wallet className="size-5" />}
            label="Money"
            onClick={() => setTab("money")}
          />
          <NavButton
            active={tab === "seats"}
            icon={<Ticket className="size-5" />}
            label="Seats"
            onClick={() => setTab("seats")}
          />
          <NavButton
            active={tab === "team"}
            icon={<Users className="size-5" />}
            label="Team"
            onClick={() => setTab("team")}
          />
          <NavButton
            active={tab === "setlist"}
            icon={<ListMusic className="size-5" />}
            label="Songs"
            onClick={() => setTab("setlist")}
          />
        </div>
      </nav>

      {toast ? (
        <div className="fixed inset-x-4 bottom-28 z-50 mx-auto max-w-sm rounded-full bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground shadow-lg">
          {toast}
        </div>
      ) : null}

      <WhoAmI
        open={whoOpen}
        people={people}
        current={me}
        onPick={pickMe}
        onAddAndPick={pickMeAndJoin}
        onOpenChange={setWhoOpen}
      />
      <AddLead
        open={addOpen}
        me={me}
        people={people}
        onOpenChange={setAddOpen}
        onAdd={addLead}
      />
      <AddGuest
        open={addGuestOpen}
        me={me}
        people={people}
        onOpenChange={setAddGuestOpen}
        onAdd={addGuest}
      />
      <LeadEditor
        lead={active}
        people={people}
        me={me}
        open={Boolean(active)}
        onOpenChange={(open) => {
          if (!open) setActive(null);
        }}
        onSave={saveLead}
        onDelete={deleteLead}
        busy={busyId === active?.id}
      />
      <GuestEditor
        guest={activeGuest}
        people={people}
        me={me}
        open={Boolean(activeGuest)}
        onOpenChange={(open) => {
          if (!open) setActiveGuest(null);
        }}
        onSave={saveGuest}
        busy={busyId === activeGuest?.id}
      />
      <TargetEditor
        open={targetKind === "money"}
        title="Money target"
        description="What the show needs to raise. Remaining = target minus committed."
        label="Target (CAD)"
        value={settings.moneyTarget}
        onOpenChange={(open) => {
          if (!open) setTargetKind(null);
        }}
        onSave={(value) => saveSettings({ moneyTarget: value })}
      />
      <TargetEditor
        open={targetKind === "seats"}
        title="Seat target"
        description="How many people you want in the room. Remaining = target minus confirmed seats."
        label="Seats"
        value={settings.attendanceTarget}
        onOpenChange={(open) => {
          if (!open) setTargetKind(null);
        }}
        onSave={(value) => saveSettings({ attendanceTarget: value })}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card/70 px-3 py-3">
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="font-heading mt-1 text-2xl tabular-nums">{value}</p>
    </div>
  );
}

function NavButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative z-50 flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-medium touch-manipulation",
        active ? "bg-primary/15 text-primary" : "text-muted-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function LeadCard({
  lead,
  me,
  busy,
  onOpen,
  onClaim,
  onToggleDone,
}: {
  lead: Lead;
  me: string;
  busy: boolean;
  onOpen: () => void;
  onClaim: () => void;
  onToggleDone: () => void;
}) {
  const mine = Boolean(me) && lead.assignedTo === me;
  return (
    <article
      className={cn(
        "rounded-2xl border border-border/80 bg-card/80 p-3 shadow-sm backdrop-blur-sm",
        lead.done && "opacity-75"
      )}
    >
      <button type="button" onClick={onOpen} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg leading-tight font-semibold">{lead.company}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {lead.assignedTo ? (
                <PersonChip name={lead.assignedTo} />
              ) : (
                <span className="text-xs text-primary">Nobody claimed this yet</span>
              )}
              {lead.done ? (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
                  Done
                </span>
              ) : null}
              {lead.committed > 0 ? (
                <span className="text-xs font-medium text-primary">
                  {formatMoney(lead.committed)}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        {lead.outcome ? (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{lead.outcome}</p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Tap for notes and result.</p>
        )}
        {lead.updatedAt ? (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Updated {formatTime(lead.updatedAt)}
            {lead.updatedBy ? ` · ${lead.updatedBy}` : ""}
          </p>
        ) : null}
      </button>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {!lead.assignedTo ? (
          <Button
            type="button"
            className="h-12"
            disabled={busy}
            onClick={onClaim}
          >
            I’ll take this
          </Button>
        ) : (
          <Button type="button" variant="outline" className="h-12" onClick={onOpen}>
            {mine ? "Add result" : "Open"}
          </Button>
        )}
        <Button
          type="button"
          variant={lead.done ? "outline" : "secondary"}
          className="h-12"
          disabled={busy}
          onClick={onToggleDone}
        >
          <Check className="size-4" />
          {lead.done ? "Undo" : "Mark done"}
        </Button>
      </div>
    </article>
  );
}

function EmptyState({
  filter,
  me,
  onAdd,
  onPickMe,
}: {
  filter: Filter;
  me: string;
  onAdd: () => void;
  onPickMe: () => void;
}) {
  if (filter === "mine" && !me) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-border p-6 text-center">
        <p className="font-medium">Pick your name to see your list</p>
        <Button type="button" className="mt-4 h-12" onClick={onPickMe}>
          Who are you?
        </Button>
      </div>
    );
  }
  if (filter === "mine") {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-border p-6 text-center">
        <p className="font-medium">Nothing assigned to {me} right now</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Grab an unassigned name or add a new contact.
        </p>
        <Button type="button" className="mt-4 h-12" onClick={onAdd}>
          Add a contact
        </Button>
      </div>
    );
  }
  if (filter === "done") {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-border p-6 text-center">
        <p className="font-medium">No one marked done yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          After you call, tap Mark done and leave what they said.
        </p>
      </div>
    );
  }
  return (
    <div className="mt-8 rounded-2xl border border-dashed border-border p-6 text-center">
      <p className="font-medium">No matches</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Try another filter, or add the name to the board.
      </p>
      <Button type="button" className="mt-4 h-12" onClick={onAdd}>
        Add a contact
      </Button>
    </div>
  );
}
