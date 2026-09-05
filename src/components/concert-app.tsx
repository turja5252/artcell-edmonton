"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  Check,
  ClipboardList,
  FileSpreadsheet,
  Handshake,
  ImageIcon,
  Plus,
  Search,
  Share2,
  Shield,
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
import { MediaBoard } from "@/components/media-board";
import { uploadMediaFiles } from "@/lib/media-client-upload";
import { TargetEditor } from "@/components/target-editor";
import { TicketsEditor } from "@/components/tickets-editor";
import { TeamBoard } from "@/components/team-board";
import { ConcertCountdown } from "@/components/concert-countdown";
import { DeliverablesBoard } from "@/components/deliverables-board";
import { TicketQr } from "@/components/ticket-qr";
import { WhoAmI } from "@/components/who-am-i";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  mergeDeliverables,
  mergeGuests,
  mergeLeads,
  mergeMedia,
  mergeMembers,
  mergeSettings,
  parseUpdatedAt,
  snapshotStamp,
} from "@/lib/board-sync";
import { applyGuestPatch } from "@/lib/guest-patch";
import { formatMoney } from "@/lib/money";
import { formatTime } from "@/lib/people";
import type { Deliverable, Guest, GuestStatus, Lead, MediaItem, Member, Settings } from "@/lib/types";
import {
  displayGuestName,
  DECLINED_PILL_CLASS,
  MONEY_PILL_CLASS,
  PROGRESS_PILL_CLASS,
  isLeadDeclined,
  isLeadInProgress,
  leadGlowClass,
  leadProgressLabel,
  leadShowsProgressGlow,
} from "@/lib/types";
import {
  ADMIN_DISPLAY_NAME,
  canonicalizePersonName,
  isTeamAdmin,
  persistAdminUnlock,
  readAdminUnlocked,
  samePerson,
  subscribeAdminUnlock,
} from "@/lib/team-admin";
import { cn } from "@/lib/utils";

const POLL_MS = 15000;
const SAVE_POLL_DEBOUNCE_MS = 3000;
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

type Tab = "outreach" | "money" | "seats" | "team" | "deliverables" | "media";
type Filter = "mine" | "open" | "unassigned" | "done" | "all";

function matches(lead: Lead, query: string, filter: Filter, me: string) {
  const haystack = `${lead.company} ${lead.assignedTo ?? ""} ${lead.outcome} ${
    isLeadDeclined(lead) ? "declined" : ""
  } ${isLeadInProgress(lead) ? "waiting in progress" : ""}`.toLowerCase();
  if (query && !haystack.includes(query.toLowerCase())) return false;
  if (filter === "mine") return Boolean(me) && samePerson(lead.assignedTo, me);
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
  initialDeliverables,
  initialMedia,
  initialError = "",
}: {
  initialLeads: Lead[];
  initialGuests: Guest[];
  initialMembers: Member[];
  initialSettings: Settings;
  initialDeliverables: Deliverable[];
  initialMedia: MediaItem[];
  initialError?: string;
}) {
  const me = useSyncExternalStore(subscribeMe, readMe, () => "");
  const adminUnlocked = useSyncExternalStore(
    subscribeAdminUnlock,
    readAdminUnlocked,
    () => false
  );
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [guests, setGuests] = useState<Guest[]>(initialGuests);
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [deliverables, setDeliverables] = useState<Deliverable[]>(initialDeliverables);
  const [media, setMedia] = useState<MediaItem[]>(initialMedia);
  const [tab, setTab] = useState<Tab>("outreach");
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaUploadProgress, setMediaUploadProgress] = useState<number | null>(null);
  const [mediaRemovingId, setMediaRemovingId] = useState<string | null>(null);
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
  const [targetKind, setTargetKind] = useState<"money" | "seats" | null>(null);
  const [ticketsOpen, setTicketsOpen] = useState(false);
  const savingCount = useRef(0);
  const lastSaveAt = useRef(0);
  const lastWriteAt = useRef(0);
  const lastWriteStamp = useRef(0);
  const lastWriteById = useRef(new Map<string, number>());
  const busyIdRef = useRef<string | null>(null);
  const memberSaving = useRef(false);
  const settingsSaving = useRef(false);
  const mediaSaving = useRef(false);
  const identityHold = useRef<number | null>(null);
  const brandTaps = useRef<number[]>([]);
  const deletedIds = useRef({
    leads: new Set<string>(),
    guests: new Set<string>(),
    members: new Set<string>(),
    deliverables: new Set<string>(),
    media: new Set<string>(),
  });

  const people = useMemo(
    () => members.map((member) => member.name).sort((a, b) => a.localeCompare(b)),
    [members]
  );

  useEffect(() => {
    if (!hydrated || !me) return;
    if (me === ADMIN_DISPLAY_NAME || isTeamAdmin(me)) return;
    if (people.length === 0) return;
    if (people.includes(me)) return;
    const canonical = canonicalizePersonName(me, people);
    if (canonical && people.includes(canonical)) {
      writeMe(canonical);
      return;
    }
    writeMe("");
  }, [hydrated, me, people]);

  function markSaveStart() {
    savingCount.current += 1;
    lastSaveAt.current = Date.now();
  }

  function markSaveEnd() {
    savingCount.current = Math.max(0, savingCount.current - 1);
    lastSaveAt.current = Date.now();
  }

  function noteSuccessfulWrite(id?: string | null, stamp?: string | null) {
    const now = Date.now();
    lastWriteAt.current = now;
    lastSaveAt.current = now;
    const writeMs = parseUpdatedAt(stamp) || now;
    lastWriteStamp.current = Math.max(lastWriteStamp.current, writeMs);
    if (id) lastWriteById.current.set(id, writeMs);
  }

  function applyRemoteBoard(
    data: {
      leads?: Lead[];
      guests?: Guest[];
      members?: Member[];
      settings?: Settings;
      deliverables?: Deliverable[];
      media?: MediaItem[];
      mediaDeletedIds?: string[];
    },
    mode: "poll" | "replace"
  ) {
    if (data.mediaDeletedIds?.length) {
      for (const id of data.mediaDeletedIds) deletedIds.current.media.add(id);
    }
    if (mode === "replace") {
      if (data.leads) {
        setLeads(data.leads.filter((item) => !deletedIds.current.leads.has(item.id)));
      }
      if (data.guests) {
        setGuests(data.guests.filter((item) => !deletedIds.current.guests.has(item.id)));
      }
      if (data.members) {
        setMembers(data.members.filter((item) => !deletedIds.current.members.has(item.id)));
      }
      if (data.settings) setSettings(data.settings);
      if (data.deliverables) {
        setDeliverables(
          data.deliverables.filter((item) => !deletedIds.current.deliverables.has(item.id))
        );
      }
      if (data.media) {
        setMedia((current) =>
          mergeMedia(
            current,
            data.media!,
            deletedIds.current.media,
            busyIdRef.current,
            lastWriteById.current
          )
        );
      }
      return;
    }
    if (data.leads) {
      setLeads((current) =>
        mergeLeads(
          current,
          data.leads!,
          deletedIds.current.leads,
          busyIdRef.current,
          lastWriteById.current
        )
      );
    }
    if (data.guests) {
      setGuests((current) =>
        mergeGuests(
          current,
          data.guests!,
          deletedIds.current.guests,
          busyIdRef.current,
          lastWriteById.current
        )
      );
    }
    if (data.members) {
      setMembers((current) => mergeMembers(current, data.members!, deletedIds.current.members));
    }
    if (data.settings) {
      setSettings((current) => mergeSettings(current, data.settings!));
    }
    if (data.deliverables) {
      setDeliverables((current) =>
        mergeDeliverables(
          current,
          data.deliverables!,
          deletedIds.current.deliverables,
          busyIdRef.current,
          lastWriteById.current
        )
      );
    }
    if (data.media) {
      setMedia((current) =>
        mergeMedia(
          current,
          data.media!,
          deletedIds.current.media,
          busyIdRef.current,
          lastWriteById.current
        )
      );
    }
  }

  function saveInFlight() {
    return (
      savingCount.current > 0 ||
      busyIdRef.current != null ||
      memberSaving.current ||
      settingsSaving.current ||
      mediaSaving.current ||
      Date.now() - Math.max(lastSaveAt.current, lastWriteAt.current) <
        SAVE_POLL_DEBOUNCE_MS
    );
  }

  const load = useCallback(async (mode: "poll" | "replace" = "replace") => {
    if (mode === "poll" && saveInFlight()) return;
    const response = await fetch("/api/board", { cache: "no-store" });
    const data = (await response.json()) as {
      leads?: Lead[];
      guests?: Guest[];
      members?: Member[];
      settings?: Settings;
      deliverables?: Deliverable[];
      media?: MediaItem[];
      mediaDeletedIds?: string[];
      writtenAt?: string | null;
      error?: string;
    };
    if (!response.ok) throw new Error(data.error || "Could not load the board");
    if (mode === "poll" && saveInFlight()) return;
    const remoteStamp = snapshotStamp(data);
    if (
      lastWriteStamp.current > 0 &&
      remoteStamp > 0 &&
      remoteStamp < lastWriteStamp.current
    ) {
      return;
    }
    applyRemoteBoard(data, mode === "poll" ? "poll" : "replace");
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void load("poll").catch(() => undefined);
    }, POLL_MS);
    const onFocus = () => void load("poll").catch(() => undefined);
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

  useEffect(() => () => clearIdentityHold(), []);

  function revealExtraIdentity() {
    if (!readAdminUnlocked()) {
      persistAdminUnlock();
      setToast("Got it");
    }
    setWhoOpen(true);
  }

  function clearIdentityHold() {
    if (identityHold.current != null) {
      window.clearTimeout(identityHold.current);
      identityHold.current = null;
    }
  }

  function onIdentityPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    clearIdentityHold();
    identityHold.current = window.setTimeout(() => {
      identityHold.current = null;
      revealExtraIdentity();
    }, 1800);
  }

  function onBrandActivate() {
    const now = Date.now();
    brandTaps.current = brandTaps.current.filter((stamp) => now - stamp < 4000);
    brandTaps.current.push(now);
    if (brandTaps.current.length >= 7) {
      brandTaps.current = [];
      revealExtraIdentity();
    }
  }

  function pickMe(name: string) {
    writeMe(name);
    setWhoForced(false);
    setWhoSkipped(false);
    if (isTeamAdmin(name)) {
      setTab("team");
      return;
    }
    setFilter("mine");
  }

  async function addMember(input: { name: string; phone?: string; email?: string }) {
    if (!isTeamAdmin(me)) {
      throw new Error("Switch Updating as to Admin to manage teammates");
    }
    memberSaving.current = true;
    markSaveStart();
    try {
      const response = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, actor: me }),
      });
      const data = (await response.json()) as { member?: Member; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not add member");
      if (data.member) {
        noteSuccessfulWrite(data.member.id);
        setMembers((current) => {
          if (current.some((member) => member.id === data.member!.id)) return current;
          return [...current, data.member!].sort((a, b) => a.name.localeCompare(b.name));
        });
        setToast(`${data.member.name} joined the team`);
      }
    } finally {
      memberSaving.current = false;
      markSaveEnd();
    }
  }

  async function removeMember(id: string) {
    if (!isTeamAdmin(me)) {
      throw new Error("Switch Updating as to Admin to manage teammates");
    }
    const removed = members.find((member) => member.id === id);
    memberSaving.current = true;
    markSaveStart();
    deletedIds.current.members.add(id);
    try {
      const response = await fetch(`/api/members/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor: me }),
      });
      const data = (await response.json()) as {
        members?: Member[];
        leads?: Lead[];
        guests?: Guest[];
        deliverables?: Deliverable[];
        error?: string;
      };
      if (!response.ok) {
        deletedIds.current.members.delete(id);
        throw new Error(data.error || "Could not remove member");
      }
      noteSuccessfulWrite(id);
      if (data.members) setMembers(data.members);
      else setMembers((current) => current.filter((member) => member.id !== id));
      if (data.leads) setLeads(data.leads);
      if (data.guests) setGuests(data.guests);
      if (data.deliverables) setDeliverables(data.deliverables);
      if (removed && me === removed.name) writeMe("");
      setToast("Removed from the team");
    } catch (error) {
      deletedIds.current.members.delete(id);
      throw error;
    } finally {
      memberSaving.current = false;
      markSaveEnd();
    }
  }

  async function saveMember(
    id: string,
    input: { name: string; phone?: string; email?: string }
  ) {
    if (!isTeamAdmin(me)) {
      throw new Error("Switch Updating as to Admin to manage teammates");
    }
    const previous = members.find((member) => member.id === id);
    memberSaving.current = true;
    markSaveStart();
    try {
      const response = await fetch(`/api/members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, actor: me }),
      });
      const data = (await response.json()) as { member?: Member; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save member");
      if (data.member) {
        noteSuccessfulWrite(data.member.id);
        setMembers((current) =>
          current
            .map((member) => (member.id === id ? data.member! : member))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
        if (previous && previous.name !== data.member.name) {
          setLeads((current) =>
            current.map((lead) => ({
              ...lead,
              assignedTo:
                lead.assignedTo === previous.name ? data.member!.name : lead.assignedTo,
              receivedBy:
                lead.receivedBy === previous.name ? data.member!.name : lead.receivedBy,
              updatedBy:
                lead.updatedBy === previous.name ? data.member!.name : lead.updatedBy,
            }))
          );
          setGuests((current) =>
            current.map((guest) => ({
              ...guest,
              assignedTo:
                guest.assignedTo === previous.name
                  ? data.member!.name
                  : guest.assignedTo,
              updatedBy:
                guest.updatedBy === previous.name ? data.member!.name : guest.updatedBy,
            }))
          );
          setDeliverables((current) =>
            current.map((item) => ({
              ...item,
              assignedTo:
                item.assignedTo === previous.name ? data.member!.name : item.assignedTo,
              updatedBy:
                item.updatedBy === previous.name ? data.member!.name : item.updatedBy,
            }))
          );
          setMedia((current) =>
            current.map((item) => ({
              ...item,
              uploadedBy:
                item.uploadedBy === previous.name ? data.member!.name : item.uploadedBy,
            }))
          );
          if (me === previous.name) writeMe(data.member.name);
        }
        setToast(`${data.member.name} updated`);
      }
    } finally {
      memberSaving.current = false;
      markSaveEnd();
    }
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
    busyIdRef.current = id;
    markSaveStart();
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
        noteSuccessfulWrite(id, data.lead.updatedAt);
        setLeads((current) =>
          current.map((lead) => (lead.id === id ? data.lead! : lead))
        );
        setActive((current) => (current?.id === id ? data.lead! : current));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
      await load("replace");
    } finally {
      setBusyId(null);
      busyIdRef.current = null;
      markSaveEnd();
    }
  }

  async function deleteLead(id: string) {
    const removed = leads.find((lead) => lead.id === id);
    deletedIds.current.leads.add(id);
    markSaveStart();
    setLeads((current) => current.filter((lead) => lead.id !== id));
    setActive(null);
    try {
      const response = await fetch(`/api/leads/${id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not delete");
      noteSuccessfulWrite(id);
      setToast(removed ? `Removed ${removed.company}` : "Entry deleted");
    } catch (err) {
      deletedIds.current.leads.delete(id);
      setError(err instanceof Error ? err.message : "Could not delete");
      await load("replace");
    } finally {
      markSaveEnd();
    }
  }

  async function addLead(company: string, assignedTo: string | null) {
    markSaveStart();
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, assignedTo, actor: me }),
      });
      const data = (await response.json()) as { lead?: Lead; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not add");
      if (data.lead) {
        noteSuccessfulWrite(data.lead.id, data.lead.updatedAt);
        setLeads((current) => [...current, data.lead!]);
      }
      setToast(`${company} is on the board`);
    } finally {
      markSaveEnd();
    }
  }

  async function saveGuest(id: string, patch: Partial<Guest> & { actor?: string; contactVia?: "call" | "text" }) {
    setBusyId(id);
    busyIdRef.current = id;
    markSaveStart();
    const contactedAt = patch.contactVia ? new Date().toISOString() : null;
    setGuests((current) =>
      current.map((guest) =>
        guest.id === id
          ? applyGuestPatch(guest, patch, contactedAt, me)
          : guest
      )
    );
    setActiveGuest((current) =>
      current && current.id === id
        ? applyGuestPatch(current, patch, contactedAt, me)
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
        noteSuccessfulWrite(id, data.guest.updatedAt);
        setGuests((current) =>
          current.map((guest) => (guest.id === id ? data.guest! : guest))
        );
        setActiveGuest((current) => (current?.id === id ? data.guest! : current));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
      await load("replace");
    } finally {
      setBusyId(null);
      busyIdRef.current = null;
      markSaveEnd();
    }
  }

  async function addGuest(input: AddGuestInput) {
    markSaveStart();
    try {
      const response = await fetch("/api/guests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, actor: me }),
      });
      const data = (await response.json()) as { guest?: Guest; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not add");
      if (data.guest) {
        noteSuccessfulWrite(data.guest.id, data.guest.updatedAt);
        setGuests((current) => [...current, data.guest!]);
      }
      setToast(`${displayGuestName(data.guest ?? input)} is on the call list`);
    } finally {
      markSaveEnd();
    }
  }

  async function addGuests(inputs: AddGuestInput[]) {
    markSaveStart();
    try {
      const response = await fetch("/api/guests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guests: inputs, actor: me }),
      });
      const data = (await response.json()) as {
        guests?: Guest[];
        added?: number;
        skipped?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || "Could not add contacts");
      if (data.guests?.length) {
        for (const guest of data.guests) {
          noteSuccessfulWrite(guest.id, guest.updatedAt);
        }
        setGuests((current) => [...current, ...data.guests!]);
      }
      const added = data.added ?? data.guests?.length ?? 0;
      const skipped = data.skipped ?? 0;
      if (added) {
        setToast(
          skipped
            ? `Added ${added} from your phone · skipped ${skipped} duplicates`
            : `Added ${added} from your phone`
        );
      } else if (skipped) {
        setToast("Those contacts are already on the list");
      }
      return { added, skipped };
    } finally {
      markSaveEnd();
    }
  }

  async function saveDeliverable(
    id: string,
    patch: Partial<Deliverable> & { actor?: string }
  ) {
    setBusyId(id);
    busyIdRef.current = id;
    markSaveStart();
    setDeliverables((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              ...patch,
              assignedTo:
                patch.assignedTo === undefined ? item.assignedTo : patch.assignedTo,
              startDate:
                patch.startDate === undefined ? item.startDate : patch.startDate,
              updatedAt: new Date().toISOString(),
              updatedBy: patch.actor ?? me ?? item.updatedBy,
            }
          : item
      )
    );
    try {
      const response = await fetch(`/api/deliverables/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...patch, actor: patch.actor ?? me }),
      });
      const data = (await response.json()) as { deliverable?: Deliverable; error?: string };
      if (!response.ok) throw new Error(data.error || "Update failed");
      if (data.deliverable) {
        noteSuccessfulWrite(id, data.deliverable.updatedAt);
        setDeliverables((current) =>
          current.map((item) => (item.id === id ? data.deliverable! : item))
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
      await load("replace");
    } finally {
      setBusyId(null);
      busyIdRef.current = null;
      markSaveEnd();
    }
  }

  async function addDeliverable(input: {
    title: string;
    assignedTo: string;
    dueDate: string;
    startDate: string;
    notes: string;
  }) {
    markSaveStart();
    try {
      const response = await fetch("/api/deliverables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: input.title,
          assignedTo: input.assignedTo,
          dueDate: input.dueDate,
          startDate: input.startDate || null,
          notes: input.notes,
          actor: me,
        }),
      });
      const data = (await response.json()) as { deliverable?: Deliverable; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not add");
      if (data.deliverable) {
        noteSuccessfulWrite(data.deliverable.id, data.deliverable.updatedAt);
        setDeliverables((current) => [...current, data.deliverable!]);
      }
      setToast(`${input.title} is on the list`);
    } finally {
      markSaveEnd();
    }
  }

  async function deleteDeliverable(id: string) {
    const removed = deliverables.find((item) => item.id === id);
    deletedIds.current.deliverables.add(id);
    markSaveStart();
    setDeliverables((current) => current.filter((item) => item.id !== id));
    try {
      const response = await fetch(`/api/deliverables/${id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not delete");
      noteSuccessfulWrite(id);
      setToast(removed ? `Removed ${removed.title}` : "Task deleted");
    } catch (err) {
      deletedIds.current.deliverables.delete(id);
      setError(err instanceof Error ? err.message : "Could not delete");
      await load("replace");
    } finally {
      markSaveEnd();
    }
  }

  async function uploadMedia(files: FileList) {
    mediaSaving.current = true;
    setMediaUploading(true);
    setMediaUploadProgress(0);
    markSaveStart();
    setError("");
    try {
      const uploaded = await uploadMediaFiles(Array.from(files), {
        actor: me || null,
        onProgress: setMediaUploadProgress,
      });
      if (uploaded.length) {
        for (const item of uploaded) {
          noteSuccessfulWrite(item.id, item.uploadedAt);
        }
        setMedia((current) => {
          const seen = new Set(current.map((item) => item.id));
          return [...current, ...uploaded.filter((item) => !seen.has(item.id))];
        });
        setToast(
          uploaded.length === 1 ? "File uploaded" : `${uploaded.length} files uploaded`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      mediaSaving.current = false;
      setMediaUploading(false);
      setMediaUploadProgress(null);
      markSaveEnd();
    }
  }

  async function deleteMedia(item: MediaItem) {
    deletedIds.current.media.add(item.id);
    mediaSaving.current = true;
    setMediaRemovingId(item.id);
    markSaveStart();
    setMedia((current) => current.filter((row) => row.id !== item.id));
    setError("");
    try {
      const response = await fetch(`/api/media/${item.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor: me || null }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not delete file");
      noteSuccessfulWrite(item.id, new Date().toISOString());
      setToast("File deleted");
    } catch (err) {
      deletedIds.current.media.delete(item.id);
      setError(err instanceof Error ? err.message : "Could not delete file");
      await load("replace");
    } finally {
      mediaSaving.current = false;
      setMediaRemovingId(null);
      markSaveEnd();
    }
  }

  async function saveSettings(patch: Partial<Settings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    settingsSaving.current = true;
    markSaveStart();
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...patch, actor: me }),
      });
      const data = (await response.json()) as { settings?: Settings; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save target");
      if (data.settings) {
        noteSuccessfulWrite("settings", data.settings.ticketsSoldUpdatedAt);
        setSettings(data.settings);
      }
      setToast(
        patch.ticketsSold !== undefined ? "Ticket count saved" : "Target saved"
      );
    } finally {
      settingsSaving.current = false;
      markSaveEnd();
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
  const myOpen = leads.filter((lead) => samePerson(lead.assignedTo, me) && !lead.done).length;

  const visible = leads
    .filter((lead) => matches(lead, query, filter, me))
    .sort((a, b) => Number(a.done) - Number(b.done) || a.company.localeCompare(b.company));

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "mine", label: me ? `${me.split(" ")[0]}` : "Mine", count: me ? leads.filter((l) => samePerson(l.assignedTo, me)).length : 0 },
    { id: "open", label: "Open", count: openCount },
    { id: "unassigned", label: "Need owner", count: unassignedCount },
    { id: "done", label: "Completed", count: doneCount },
    { id: "all", label: "All", count: leads.length },
  ];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 pb-32 sm:px-6">
      <header className="sticky top-0 z-20 -mx-4 flex flex-wrap items-start justify-between gap-3 border-b border-border/50 bg-background/90 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div
          className="min-w-0 flex-1 select-none"
          onClick={onBrandActivate}
        >
          <p className="text-[11px] font-medium tracking-[0.22em] text-primary uppercase">
            Edmonton show
          </p>
          <h1 className="font-heading text-4xl leading-none tracking-wide sm:text-5xl">
            Artcell
          </h1>
          <ConcertCountdown concertDate={settings.concertDate} />
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <TicketQr url={settings.ticketUrl} variant="compact" />
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
          </div>
        </div>
      </header>

      <button
        type="button"
        onClick={() => setWhoOpen(true)}
        onPointerDown={onIdentityPointerDown}
        onPointerUp={clearIdentityHold}
        onPointerCancel={clearIdentityHold}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") clearIdentityHold();
        }}
        onContextMenu={(event) => event.preventDefault()}
        className={cn(
          "relative z-10 mt-4 flex w-full select-none items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left active:bg-card",
          isTeamAdmin(me)
            ? "border-primary/70 bg-primary/10"
            : "border-border/80 bg-card/70"
        )}
      >
        <span className="min-w-0">
          <span className="block text-sm text-muted-foreground">Updating as</span>
          {adminUnlocked ? (
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Who are you? Admin is the first choice
            </span>
          ) : null}
        </span>
        {isTeamAdmin(me) ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border-2 border-primary bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground">
            <Shield className="size-3.5" />
            Admin
          </span>
        ) : me ? (
          <PersonChip name={me} />
        ) : (
          <span className="shrink-0 text-sm font-medium text-primary">
            {adminUnlocked ? "Tap your name or Admin" : "Tap your name"}
          </span>
        )}
      </button>

      {tab === "outreach" ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="Reached" value={`${doneCount}/${leads.length || "—"}`} />
          <Stat label="Still open" value={String(openCount)} />
          <Stat label={me ? "Your open" : "Need owner"} value={String(me ? myOpen : unassignedCount)} />
        </div>
      ) : null}

      {error && tab !== "media" ? (
        <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
          <Button
            type="button"
            variant="ghost"
            className="ml-2 h-8"
            onClick={() => {
              setError("");
              void load("poll");
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
            <ul className="mt-4 space-y-3 overflow-visible py-1">
              {visible.map((lead) => (
                <li key={lead.id} className="overflow-visible">
                  <LeadCard
                    lead={lead}
                    me={me}
                    busy={busyId === lead.id}
                    onOpen={() => setActive(lead)}
                    onClaim={() => {
                      if (!me || isTeamAdmin(me)) {
                        setWhoOpen(true);
                        if (isTeamAdmin(me)) {
                          setToast("Pick your name to claim a call — Admin only manages the roster");
                        }
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
            members={members}
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
            ticketsSold={settings.ticketsSold}
            ticketsSoldUpdatedAt={settings.ticketsSoldUpdatedAt}
            ticketsSoldUpdatedBy={settings.ticketsSoldUpdatedBy}
            ticketUrl={settings.ticketUrl}
            me={me}
            filter={seatFilter}
            onFilter={setSeatFilter}
            onSetTarget={() => setTargetKind("seats")}
            onEditTickets={() => setTicketsOpen(true)}
            onOpen={(guest) => setActiveGuest(guest)}
            onClaim={(guest) => {
              if (!me || isTeamAdmin(me)) {
                setWhoOpen(true);
                if (isTeamAdmin(me)) {
                  setToast("Pick your name to claim a guest — Admin only manages the roster");
                }
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
            onContact={(guest, via) => {
              void saveGuest(guest.id, { contactVia: via, actor: me });
              setToast(via === "call" ? "Logged as called" : "Logged as texted");
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
            canManage={isTeamAdmin(me)}
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
            onSave={saveMember}
            onRemove={removeMember}
          />
        </section>
      )}

      {tab === "deliverables" && (
        <section className="mt-5 flex-1">
          <DeliverablesBoard
            items={deliverables}
            people={people}
            me={me}
            busyId={busyId}
            onPickMe={() => setWhoOpen(true)}
            onAdd={addDeliverable}
            onSave={saveDeliverable}
            onDelete={deleteDeliverable}
          />
        </section>
      )}

      {tab === "media" && (
        <section className="mt-5 flex-1">
          <MediaBoard
            items={media}
            uploading={mediaUploading}
            uploadProgress={mediaUploadProgress}
            removingId={mediaRemovingId}
            error={error}
            onRetry={() => {
              setError("");
              void load("poll");
            }}
            onUpload={(files) => void uploadMedia(files)}
            onDelete={(item) => void deleteMedia(item)}
          />
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

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-background/95 px-1 pt-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md">
        <div className="mx-auto grid max-w-3xl grid-cols-6 gap-0">
          <NavButton
            active={tab === "outreach"}
            icon={<Handshake className="size-4" />}
            label="Calls"
            onClick={() => setTab("outreach")}
          />
          <NavButton
            active={tab === "money"}
            icon={<Wallet className="size-4" />}
            label="Money"
            onClick={() => setTab("money")}
          />
          <NavButton
            active={tab === "seats"}
            icon={<Ticket className="size-4" />}
            label="Seats"
            onClick={() => setTab("seats")}
          />
          <NavButton
            active={tab === "deliverables"}
            icon={<ClipboardList className="size-4" />}
            label="List"
            onClick={() => setTab("deliverables")}
          />
          <NavButton
            active={tab === "team"}
            icon={<Users className="size-4" />}
            label="Team"
            onClick={() => setTab("team")}
          />
          <NavButton
            active={tab === "media"}
            icon={<ImageIcon className="size-4" />}
            label="Media"
            onClick={() => setTab("media")}
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
        showAdmin={adminUnlocked}
        onPick={pickMe}
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
        onAddMany={addGuests}
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
        onLeadChange={(lead) => {
          noteSuccessfulWrite(lead.id, lead.updatedAt);
          setLeads((current) =>
            current.map((item) => (item.id === lead.id ? lead : item))
          );
          setActive(lead);
        }}
        onDelete={deleteLead}
        busy={busyId === active?.id}
      />
      <GuestEditor
        guest={activeGuest}
        people={people}
        me={me}
        ticketUrl={settings.ticketUrl}
        open={Boolean(activeGuest)}
        onOpenChange={(open) => {
          if (!open) setActiveGuest(null);
        }}
        onSave={saveGuest}
        busy={busyId === activeGuest?.id}
        onContact={(via) => {
          if (!activeGuest) return;
          void saveGuest(activeGuest.id, { contactVia: via, actor: me });
          setToast(via === "call" ? "Logged as called" : "Logged as texted");
        }}
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
      <TicketsEditor
        open={ticketsOpen}
        ticketsSold={settings.ticketsSold}
        updatedAt={settings.ticketsSoldUpdatedAt}
        me={me}
        onOpenChange={setTicketsOpen}
        onSave={(input) => saveSettings(input)}
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
        "relative z-50 flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 text-[10px] font-medium touch-manipulation sm:h-14 sm:text-xs",
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
  const mine = Boolean(me) && samePerson(lead.assignedTo, me);
  const declined = isLeadDeclined(lead);
  const progress = leadShowsProgressGlow(lead);
  return (
    <article
      className={cn(
        "overflow-visible rounded-2xl border border-border/80 bg-card/80 p-3",
        leadGlowClass(lead),
        lead.done && !declined && "opacity-75"
      )}
    >
      <button type="button" onClick={onOpen} className="w-full overflow-visible text-left">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg leading-tight font-semibold">{lead.company}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {lead.assignedTo ? (
                <PersonChip name={lead.assignedTo} />
              ) : (
                <span className="text-xs text-primary">Nobody claimed this yet</span>
              )}
              {declined ? <span className={DECLINED_PILL_CLASS}>Declined</span> : null}
              {progress ? (
                <span className={PROGRESS_PILL_CLASS}>{leadProgressLabel(lead)}</span>
              ) : null}
              {lead.done ? (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
                  Completed
                </span>
              ) : null}
              {!declined && lead.committed > 0 ? (
                <span className={MONEY_PILL_CLASS}>Pledged {formatMoney(lead.committed)}</span>
              ) : lead.committed > 0 ? (
                <span className="text-xs font-medium text-foreground">
                  Pledged {formatMoney(lead.committed)}
                </span>
              ) : null}
              {!declined && lead.received > 0 ? (
                <span className={MONEY_PILL_CLASS}>Received {formatMoney(lead.received)}</span>
              ) : lead.received > 0 ? (
                <span className="text-xs font-medium text-muted-foreground">
                  Received {formatMoney(lead.received)}
                </span>
              ) : null}
              {(lead.attachments?.length ?? 0) > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {lead.attachments.length} file{lead.attachments.length === 1 ? "" : "s"}
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
          {lead.done ? "Reopen" : "Mark completed"}
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
        <p className="font-medium">No one marked completed yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          After you call, tap Mark completed when there is nothing left to do.
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
