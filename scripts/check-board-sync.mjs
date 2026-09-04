import assert from "node:assert/strict";

function parseUpdatedAt(value) {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function isRemoteNewer(local, remote) {
  const remoteAt = parseUpdatedAt(remote);
  if (remoteAt === 0) return false;
  return remoteAt > parseUpdatedAt(local);
}

function merge(local, remote, lastWriteById = new Map()) {
  const localById = new Map(local.map((item) => [item.id, item]));
  const remoteById = new Map(remote.map((item) => [item.id, item]));
  const ids = new Set([...localById.keys(), ...remoteById.keys()]);
  const merged = [];
  for (const id of ids) {
    const localItem = localById.get(id);
    const remoteItem = remoteById.get(id);
    if (localItem && !remoteItem) {
      merged.push(localItem);
      continue;
    }
    if (remoteItem && !localItem) {
      merged.push(remoteItem);
      continue;
    }
    const writeAt = lastWriteById.get(id) ?? 0;
    const remoteAt = parseUpdatedAt(remoteItem.updatedAt);
    if (writeAt > 0 && remoteAt <= writeAt) {
      merged.push(localItem);
      continue;
    }
    merged.push(isRemoteNewer(localItem.updatedAt, remoteItem.updatedAt) ? remoteItem : localItem);
  }
  return merged;
}

const older = "2026-09-04T21:00:00.000Z";
const newer = "2026-09-04T22:00:00.000Z";

assert.equal(isRemoteNewer(newer, older), false);
assert.equal(isRemoteNewer(newer, newer), false);
assert.equal(isRemoteNewer(newer, null), false);
assert.equal(isRemoteNewer(null, null), false);
assert.equal(isRemoteNewer(older, newer), true);

const kept = merge(
  [{ id: "a", done: true, updatedAt: newer }],
  [{ id: "a", done: false, updatedAt: older }]
);
assert.equal(kept[0].done, true);

const equal = merge(
  [{ id: "a", done: true, updatedAt: newer }],
  [{ id: "a", done: false, updatedAt: newer }]
);
assert.equal(equal[0].done, true);

const missing = merge(
  [{ id: "a", done: true, updatedAt: newer }],
  [{ id: "a", done: false, updatedAt: null }]
);
assert.equal(missing[0].done, true);

const writeClock = new Map([["a", Date.parse(newer)]]);
const staleAfterWrite = merge(
  [{ id: "a", done: true, updatedAt: newer }],
  [{ id: "a", done: false, updatedAt: older }],
  writeClock
);
assert.equal(staleAfterWrite[0].done, true);

console.log("board-sync merge rules ok");
