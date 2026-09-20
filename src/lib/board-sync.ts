import { canonicalizeTicketUrl } from "@/lib/tickets";
import type { Deliverable, Guest, Lead, MediaItem, McPromptStore, Member, Settings } from "@/lib/types";

export function parseUpdatedAt(value: string | null | undefined): number {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

export function isNewerStamp(
  local: string | null | undefined,
  remote: string | null | undefined
): boolean {
  return parseUpdatedAt(local) > parseUpdatedAt(remote);
}

/** Remote wins only when it has a stamp strictly after local. Missing or equal → keep local. */
export function isRemoteNewer(
  local: string | null | undefined,
  remote: string | null | undefined
): boolean {
  const remoteAt = parseUpdatedAt(remote);
  if (remoteAt === 0) return false;
  return remoteAt > parseUpdatedAt(local);
}

export function maxUpdatedAt(
  items: Array<{ updatedAt?: string | null } | null | undefined>
): number {
  let max = 0;
  for (const item of items) {
    if (!item) continue;
    max = Math.max(max, parseUpdatedAt(item.updatedAt));
  }
  return max;
}

export function snapshotStamp(input: {
  writtenAt?: string | null;
  leads?: Array<{ updatedAt?: string | null }>;
  guests?: Array<{ updatedAt?: string | null }>;
  deliverables?: Array<{ updatedAt?: string | null }>;
  media?: Array<{ uploadedAt?: string | null; updatedAt?: string | null }>;
  settings?: { ticketsSoldUpdatedAt?: string | null } | null;
  mcPrompts?: { updatedAt?: string | null } | null;
}): number {
  const meta = parseUpdatedAt(input.writtenAt);
  if (meta > 0) return meta;
  return Math.max(
    maxUpdatedAt(input.leads ?? []),
    maxUpdatedAt(input.guests ?? []),
    maxUpdatedAt(input.deliverables ?? []),
    maxUpdatedAt(
      (input.media ?? []).map((item) => ({
        updatedAt: item.updatedAt ?? item.uploadedAt,
      }))
    ),
    parseUpdatedAt(input.settings?.ticketsSoldUpdatedAt),
    parseUpdatedAt(input.mcPrompts?.updatedAt)
  );
}

type Stamped = { id: string; updatedAt?: string | null };

export function mergeByUpdatedAt<T extends Stamped>(
  local: T[],
  remote: T[],
  deletedIds: Set<string>,
  pendingId?: string | null,
  lastWriteById?: Map<string, number>
): T[] {
  if (remote.length === 0 && local.length > 0) return local;

  const localById = new Map(local.map((item) => [item.id, item]));
  const remoteById = new Map(remote.map((item) => [item.id, item]));
  const ids = new Set([...localById.keys(), ...remoteById.keys()]);
  const merged: T[] = [];

  for (const id of ids) {
    if (deletedIds.has(id)) {
      if (!remoteById.has(id)) deletedIds.delete(id);
      continue;
    }
    const localItem = localById.get(id);
    const remoteItem = remoteById.get(id);
    if (pendingId === id && localItem) {
      merged.push(localItem);
      continue;
    }
    if (localItem && !remoteItem) {
      merged.push(localItem);
      continue;
    }
    if (remoteItem && !localItem) {
      merged.push(remoteItem);
      continue;
    }
    if (localItem && remoteItem) {
      const writeAt = lastWriteById?.get(id) ?? 0;
      const remoteAt = parseUpdatedAt(remoteItem.updatedAt);
      if (writeAt > 0 && remoteAt <= writeAt) {
        merged.push(localItem);
        continue;
      }
      merged.push(
        isRemoteNewer(localItem.updatedAt, remoteItem.updatedAt) ? remoteItem : localItem
      );
    }
  }
  return merged;
}

export function mergeLeads(
  local: Lead[],
  remote: Lead[],
  deletedIds: Set<string>,
  pendingId?: string | null,
  lastWriteById?: Map<string, number>
): Lead[] {
  return mergeByUpdatedAt(local, remote, deletedIds, pendingId, lastWriteById);
}

export function mergeGuests(
  local: Guest[],
  remote: Guest[],
  deletedIds: Set<string>,
  pendingId?: string | null,
  lastWriteById?: Map<string, number>
): Guest[] {
  return mergeByUpdatedAt(local, remote, deletedIds, pendingId, lastWriteById);
}

export function mergeDeliverables(
  local: Deliverable[],
  remote: Deliverable[],
  deletedIds: Set<string>,
  pendingId?: string | null,
  lastWriteById?: Map<string, number>
): Deliverable[] {
  return mergeByUpdatedAt(local, remote, deletedIds, pendingId, lastWriteById);
}

function mediaStamp(item: MediaItem): MediaItem & { updatedAt: string } {
  return { ...item, updatedAt: item.uploadedAt };
}

export function mergeMedia(
  local: MediaItem[],
  remote: MediaItem[],
  deletedIds: Set<string>,
  pendingId?: string | null,
  lastWriteById?: Map<string, number>
): MediaItem[] {
  return mergeByUpdatedAt(
    local.map(mediaStamp),
    remote.map(mediaStamp),
    deletedIds,
    pendingId,
    lastWriteById
  );
}

export function mergeMembers(
  local: Member[],
  remote: Member[],
  deletedIds: Set<string>
): Member[] {
  if (remote.length === 0 && local.length > 0) return local;

  const localById = new Map(local.map((item) => [item.id, item]));
  const remoteById = new Map(remote.map((item) => [item.id, item]));
  const ids = new Set([...localById.keys(), ...remoteById.keys()]);
  const merged: Member[] = [];

  for (const id of ids) {
    if (deletedIds.has(id)) {
      if (!remoteById.has(id)) deletedIds.delete(id);
      continue;
    }
    const localItem = localById.get(id);
    const remoteItem = remoteById.get(id);
    if (localItem && !remoteItem) {
      merged.push(localItem);
      continue;
    }
    merged.push(remoteItem ?? localItem!);
  }

  return merged.sort((a, b) => a.name.localeCompare(b.name));
}

export function mergeMcPrompts(
  local: McPromptStore,
  remote: McPromptStore,
  lastWriteById?: Map<string, number>,
  pendingId?: string | null
): McPromptStore {
  const ids = new Set([...Object.keys(local.cues), ...Object.keys(remote.cues)]);
  const cues: McPromptStore["cues"] = {};
  const remoteStoreNewer = isRemoteNewer(local.updatedAt, remote.updatedAt);

  for (const id of ids) {
    const loc = local.cues[id];
    const rem = remote.cues[id];
    const writeAt = lastWriteById?.get(`mc:${id}`) ?? 0;

    if (pendingId === id) {
      if (loc) cues[id] = loc;
      continue;
    }

    if (writeAt > 0) {
      if (loc) {
        if (!rem || parseUpdatedAt(rem.updatedAt) <= writeAt) {
          cues[id] = loc;
          continue;
        }
      } else if (!rem || parseUpdatedAt(rem.updatedAt) <= writeAt) {
        continue;
      }
    }

    if (loc && rem) {
      cues[id] = isRemoteNewer(loc.updatedAt, rem.updatedAt) ? rem : loc;
      continue;
    }
    if (rem && !loc) {
      cues[id] = rem;
      continue;
    }
    if (loc && !rem) {
      if (remoteStoreNewer && parseUpdatedAt(remote.updatedAt) > parseUpdatedAt(loc.updatedAt)) {
        continue;
      }
      cues[id] = loc;
    }
  }

  const orderWrite = lastWriteById?.get("mc:order") ?? 0;
  const remoteAt = parseUpdatedAt(remote.updatedAt);
  const keepLocalOrder =
    pendingId === "order" || (orderWrite > 0 && remoteAt > 0 && remoteAt <= orderWrite);
  const order = keepLocalOrder
    ? (local.order ?? {})
    : remoteStoreNewer
      ? (remote.order ?? {})
      : (local.order ?? remote.order ?? {});

  return {
    cues,
    order,
    updatedAt: isRemoteNewer(local.updatedAt, remote.updatedAt)
      ? remote.updatedAt
      : local.updatedAt,
  };
}

export function mergeSettings(local: Settings, remote: Settings): Settings {
  const ticketUrl = canonicalizeTicketUrl(remote.ticketUrl || local.ticketUrl);
  if (!isRemoteNewer(local.ticketsSoldUpdatedAt, remote.ticketsSoldUpdatedAt)) {
    return {
      ...remote,
      ticketUrl,
      ticketsSold: local.ticketsSold,
      ticketsSoldUpdatedAt: local.ticketsSoldUpdatedAt,
      ticketsSoldUpdatedBy: local.ticketsSoldUpdatedBy,
    };
  }
  return { ...remote, ticketUrl };
}
