/** Only the Admin identity can add/manage the teammate roster. */
export function isTeamAdmin(name: string | null | undefined): boolean {
  return (name ?? "").trim().toLowerCase() === "admin";
}

export function assertTeamAdminActor(name: string | null | undefined) {
  if (!isTeamAdmin(name)) {
    throw new Error("Only Admin can manage teammates");
  }
}

/** Reserved display name for the admin identity (not a roster teammate). */
export const ADMIN_DISPLAY_NAME = "Admin";

const PERSON_ALIASES: Record<string, string> = {
  novel: "Khaled Bari",
  khaled: "Khaled Bari",
  "khaled bhai": "Khaled Bari",
  "khaled bari": "Khaled Bari",
};

/** Map legacy / nickname labels onto the current roster name when possible. */
export function canonicalizePersonName(
  value: string | null | undefined,
  allowedNames: Iterable<string>
): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;

  const allowed = [...allowedNames];
  const exact = allowed.find((name) => name === raw);
  if (exact) return exact;

  const caseMatch = allowed.find((name) => name.toLowerCase() === raw.toLowerCase());
  if (caseMatch) return caseMatch;

  const aliased = PERSON_ALIASES[raw.toLowerCase()];
  if (aliased) {
    const hit = allowed.find((name) => name.toLowerCase() === aliased.toLowerCase());
    if (hit) return hit;
  }

  // "Khaled …" nicknames → the one Khaled on the roster, if unique.
  const first = raw.toLowerCase().split(/\s+/)[0];
  if (first) {
    const sameFirst = allowed.filter(
      (name) => name.toLowerCase().split(/\s+/)[0] === first
    );
    if (sameFirst.length === 1) return sameFirst[0];
  }

  return raw;
}

export function resolveAssignee(
  value: string | null | undefined,
  allowedNames: Iterable<string>
): string | null {
  const canonical = canonicalizePersonName(value, allowedNames);
  if (!canonical) return null;
  const allowed = new Set(
    [...allowedNames].map((name) => name.trim()).filter(Boolean)
  );
  return allowed.has(canonical) ? canonical : null;
}
