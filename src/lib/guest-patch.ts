import type { Guest, GuestPatch } from "@/lib/types";
import {
  normalizeContactLog,
  normalizeContactVia,
  normalizeGuestStatus,
} from "@/lib/types";

/**
 * Shared guest merge used by the server `patchGuest` write and the client
 * optimistic update. Always defaults `contactLog` so older saved guests
 * (no array on disk) do not crash when Call / Text is tapped.
 */
export function applyGuestPatch(
  guest: Guest,
  patch: GuestPatch,
  contactedAt?: string | null,
  actorFallback?: string | null
): Guest {
  const firstName =
    patch.firstName === undefined ? (guest.firstName ?? "") : patch.firstName.trim();
  const lastName =
    patch.lastName === undefined ? (guest.lastName ?? "") : patch.lastName.trim();
  const nameFromParts = `${firstName} ${lastName}`.trim();
  const via = normalizeContactVia(patch.contactVia);
  const actor = (patch.actor ?? actorFallback)?.trim() || null;
  const now = via ? contactedAt?.trim() || new Date().toISOString() : null;
  const currentLog = normalizeContactLog(guest.contactLog);
  const nextLog = via
    ? [{ at: now!, via, by: actor }, ...currentLog].slice(0, 8)
    : patch.contactLog === undefined
      ? currentLog
      : normalizeContactLog(patch.contactLog);

  return {
    ...guest,
    firstName,
    lastName,
    name: nameFromParts || patch.name?.trim() || guest.name,
    phone: patch.phone === undefined ? (guest.phone ?? "") : patch.phone,
    email: patch.email === undefined ? (guest.email ?? "") : patch.email,
    assignedTo: patch.assignedTo === undefined ? guest.assignedTo : patch.assignedTo,
    status: patch.status === undefined ? guest.status : normalizeGuestStatus(patch.status),
    partySize:
      patch.partySize === undefined
        ? Math.max(1, Number(guest.partySize) || 1)
        : Math.max(1, Number(patch.partySize) || 1),
    ticketBought:
      patch.ticketBought === undefined ? Boolean(guest.ticketBought) : Boolean(patch.ticketBought),
    lastContactedAt: via
      ? now
      : patch.lastContactedAt === undefined
        ? (guest.lastContactedAt ?? null)
        : patch.lastContactedAt,
    lastContactedVia: via ?? guest.lastContactedVia ?? null,
    lastCalledAt: via === "call" ? now : (guest.lastCalledAt ?? null),
    lastCalledBy: via === "call" ? actor : (guest.lastCalledBy ?? null),
    lastTextedAt: via === "text" ? now : (guest.lastTextedAt ?? null),
    lastTextedBy: via === "text" ? actor : (guest.lastTextedBy ?? null),
    contactLog: nextLog,
    notes: patch.notes === undefined ? (guest.notes ?? "") : patch.notes,
    updatedAt: new Date().toISOString(),
    updatedBy: actor ?? guest.updatedBy ?? null,
  };
}
