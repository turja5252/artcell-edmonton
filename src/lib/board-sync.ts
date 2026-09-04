import type { Guest, Lead, Member, Settings } from "@/lib/types";

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

type Stamped = { id: string; updatedAt?: string | null };

export function mergeByUpdatedAt<T extends Stamped>(
  local: T[],
  remote: T[],
  deletedIds: Set<string>,
  pendingId?: string | null
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
      merged.push(
        isNewerStamp(localItem.updatedAt, remoteItem.updatedAt) ? localItem : remoteItem
      );
    }
  }
  return merged;
}

export function mergeLeads(
  local: Lead[],
  remote: Lead[],
  deletedIds: Set<string>,
  pendingId?: string | null
): Lead[] {
  return mergeByUpdatedAt(local, remote, deletedIds, pendingId);
}

export function mergeGuests(
  local: Guest[],
  remote: Guest[],
  deletedIds: Set<string>,
  pendingId?: string | null
): Guest[] {
  return mergeByUpdatedAt(local, remote, deletedIds, pendingId);
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
  if (isNewerStamp(local.ticketsSoldUpdatedAt, remote.ticketsSoldUpdatedAt)) {
    return {
      ...remote,
      ticketsSold: local.ticketsSold,
      ticketsSoldUpdatedAt: local.ticketsSoldUpdatedAt,
      ticketsSoldUpdatedBy: local.ticketsSoldUpdatedBy,
    };
  }
  return remote;
}
