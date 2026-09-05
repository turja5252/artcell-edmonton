import type { Deliverable, Guest, Lead, Member, Settings } from "@/lib/types";

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
  settings?: { ticketsSoldUpdatedAt?: string | null } | null;
}): number {
  const meta = parseUpdatedAt(input.writtenAt);
  if (meta > 0) return meta;
  return Math.max(
    maxUpdatedAt(input.leads ?? []),
    maxUpdatedAt(input.guests ?? []),
    maxUpdatedAt(input.deliverables ?? []),
    parseUpdatedAt(input.settings?.ticketsSoldUpdatedAt)
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

export function mergeSettings(local: Settings, remote: Settings): Settings {
  if (!isRemoteNewer(local.ticketsSoldUpdatedAt, remote.ticketsSoldUpdatedAt)) {
    return {
      ...remote,
      ticketsSold: local.ticketsSold,
      ticketsSoldUpdatedAt: local.ticketsSoldUpdatedAt,
      ticketsSoldUpdatedBy: local.ticketsSoldUpdatedBy,
    };
  }
  return remote;
}
