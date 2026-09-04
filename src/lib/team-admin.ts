/** Only Tanzim can add/manage the teammate roster. */
export function isTeamAdmin(name: string | null | undefined): boolean {
  const normalized = (name ?? "").trim().toLowerCase();
  if (!normalized) return false;
  return normalized === "tanzim" || normalized.startsWith("tanzim ");
}
