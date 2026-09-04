type Named = {
  assignedTo?: string | null;
  updatedBy?: string | null;
  receivedBy?: string | null;
};

export function uniquePeople(...lists: Named[][]): string[] {
  const names = new Set<string>();
  for (const list of lists) {
    for (const item of list) {
      if (item.assignedTo) names.add(item.assignedTo);
      if (item.updatedBy) names.add(item.updatedBy);
      if (item.receivedBy) names.add(item.receivedBy);
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function formatTime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
