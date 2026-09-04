/** Only the Admin identity can add/manage the teammate roster. */
export function isTeamAdmin(name: string | null | undefined): boolean {
  return normalizePersonKey(name ?? "") === "admin";
}

export function assertTeamAdminActor(name: string | null | undefined) {
  if (!isTeamAdmin(name)) {
    throw new Error("Only Admin can manage teammates");
  }
}

/** Reserved display name for the admin identity (not a roster teammate). */
export const ADMIN_DISPLAY_NAME = "Admin";

export const ADMIN_UNLOCK_KEY = "artcell-edmonton-admin-unlocked";
const ADMIN_UNLOCK_EVENT = "artcell-admin-unlock";

export function subscribeAdminUnlock(onChange: () => void) {
  window.addEventListener(ADMIN_UNLOCK_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(ADMIN_UNLOCK_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function readAdminUnlocked() {
  return window.localStorage.getItem(ADMIN_UNLOCK_KEY) === "1";
}

export function persistAdminUnlock() {
  window.localStorage.setItem(ADMIN_UNLOCK_KEY, "1");
  window.dispatchEvent(new Event(ADMIN_UNLOCK_EVENT));
}

/** One roster label for Khaled / Khaled Bhai / Novel. Never store the nicknames. */
export const KHALED_CANONICAL = "Khaled Bari";

function normalizePersonKey(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, "")
    .replace(/[\u00A0\u202F\u2007]/g, " ")
    .trim()
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactPersonKey(value: string): string {
  return normalizePersonKey(value).replace(/\s+/g, "");
}

const KHALED_KEYS = new Set([
  "khaled",
  "khaled bhai",
  "khaled bari",
  "khaledbhai",
  "khaledbari",
  "novel",
]);

/** True for Khaled, Khaled Bhai, Khaled Bari, Novel, khaled-bhai (any spacing/case). */
export function isKhaledAlias(value: string | null | undefined): boolean {
  const raw = (value ?? "").trim();
  if (!raw) return false;
  const spaced = normalizePersonKey(raw);
  const compact = compactPersonKey(raw);
  return KHALED_KEYS.has(spaced) || KHALED_KEYS.has(compact);
}

export function displayPersonName(value: string): string {
  if (isTeamAdmin(value)) return ADMIN_DISPLAY_NAME;
  if (isKhaledAlias(value)) return KHALED_CANONICAL;
  return value.trim();
}

export function samePerson(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  const a = (left ?? "").trim();
  const b = (right ?? "").trim();
  if (!a || !b) return false;
  if (isKhaledAlias(a) && isKhaledAlias(b)) return true;
  if (isTeamAdmin(a) && isTeamAdmin(b)) return true;
  return (
    normalizePersonKey(a) === normalizePersonKey(b) ||
    compactPersonKey(a) === compactPersonKey(b)
  );
}

function rosterMatch(
  value: string,
  allowedNames: Iterable<string>
): string | undefined {
  const allowed = [...allowedNames].map((name) => name.trim()).filter(Boolean);
  return (
    allowed.find((name) => name === value) ||
    allowed.find((name) => name.toLowerCase() === value.toLowerCase()) ||
    allowed.find((name) => samePerson(name, value))
  );
}

function rosterKhaledName(allowedNames: Iterable<string>): string | undefined {
  return [...allowedNames]
    .map((name) => name.trim())
    .find((name) => isKhaledAlias(name) || samePerson(name, KHALED_CANONICAL));
}

/** Map legacy / nickname labels onto the current roster name when possible. */
export function canonicalizePersonName(
  value: string | null | undefined,
  allowedNames: Iterable<string>
): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  if (isTeamAdmin(raw)) return ADMIN_DISPLAY_NAME;
  if (isKhaledAlias(raw)) return KHALED_CANONICAL;

  const hit = rosterMatch(raw, allowedNames);
  if (hit) {
    return isKhaledAlias(hit) ? KHALED_CANONICAL : hit;
  }

  // Unique first-name nickname → the one roster teammate, if unique.
  const first = normalizePersonKey(raw).split(" ")[0];
  if (first) {
    const sameFirst = [...allowedNames]
      .map((name) => name.trim())
      .filter((name) => normalizePersonKey(name).split(" ")[0] === first);
    if (sameFirst.length === 1) {
      return isKhaledAlias(sameFirst[0]) ? KHALED_CANONICAL : sameFirst[0];
    }
  }

  return raw;
}

/**
 * Assignee / collector fields: must land on a roster name.
 * Khaled nicknames always persist as "Khaled Bari" when he is on the team
 * (or when we are about to rewrite his roster row to that name).
 */
export function resolveAssignee(
  value: string | null | undefined,
  allowedNames: Iterable<string>
): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  // Never drop a Khaled nickname — sanitize used to null these and bounce the card.
  if (isKhaledAlias(raw)) return KHALED_CANONICAL;
  const canonical = canonicalizePersonName(raw, allowedNames);
  if (!canonical) return null;
  if (isKhaledAlias(canonical) || samePerson(canonical, KHALED_CANONICAL)) {
    return KHALED_CANONICAL;
  }
  return rosterMatch(canonical, allowedNames) ?? null;
}

/** updatedBy / actor labels: rewrite Khaled nicknames; keep other free-text names. */
export function resolveActorName(
  value: string | null | undefined,
  allowedNames: Iterable<string> = []
): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  if (isTeamAdmin(raw)) return ADMIN_DISPLAY_NAME;
  if (isKhaledAlias(raw)) return KHALED_CANONICAL;
  const canonical = canonicalizePersonName(raw, allowedNames);
  if (!canonical) return null;
  return isKhaledAlias(canonical) ? KHALED_CANONICAL : canonical;
}

export function rewriteStoredPersonName(
  value: string | null | undefined,
  allowedNames: Iterable<string> = []
): string | null {
  return resolveActorName(value, allowedNames);
}

type NamedMember = { id: string; name: string; phone?: string; email?: string };

/** Drop Novel, collapse Khaled nicknames onto one "Khaled Bari" roster row. */
export function canonicalizeMembers<T extends NamedMember>(members: T[]): T[] {
  const kept: T[] = [];
  let khaled: T | null = null;

  for (const member of members) {
    const novelRow =
      member.id === "novel" || normalizePersonKey(member.name) === "novel";
    const khaledRow =
      member.id === "khaled-bhai" ||
      isKhaledAlias(member.id) ||
      isKhaledAlias(member.name) ||
      novelRow;

    if (!khaledRow) {
      kept.push(member);
      continue;
    }

    const folded = {
      ...member,
      id: member.id === "novel" ? "khaled-bhai" : member.id,
      name: KHALED_CANONICAL,
    } as T;

    if (!khaled) {
      khaled = folded;
      continue;
    }

    khaled = {
      ...khaled,
      phone: khaled.phone || member.phone || "",
      email: khaled.email || member.email || "",
    } as T;
  }

  if (khaled) kept.push(khaled);
  return kept.sort((a, b) => a.name.localeCompare(b.name));
}
