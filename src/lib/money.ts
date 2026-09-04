export function parseMoney(value: string | number | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : 0;
  }
  if (!value) return 0;
  const n = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

export function parseCount(value: string | number | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  }
  if (!value) return 0;
  const n = Number(String(value).replace(/[^0-9]/g, ""));
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount || 0);
}

export function formatSeats(n: number): string {
  return new Intl.NumberFormat("en-CA").format(n || 0);
}

/** Only amounts the user entered. Declined $0 pledges stay $0 and do not inflate totals. */
export function countableMoney(lead: { committed: number; received: number }): {
  committed: number;
  received: number;
} {
  return {
    committed: lead.committed > 0 ? lead.committed : 0,
    received: lead.received > 0 ? lead.received : 0,
  };
}
