export const DEFAULT_TICKET_URL =
  "https://purchase.macewan.ca/EventAvailability?EventId=14401";

const TRACKING_PARAM =
  /^(fbclid|fb_action_ids|fb_action_types|fb_source|gclid|gbraid|wbraid|msclkid|mc_eid|mc_cid|_hsenc|_hsmi|igshid|twclid)$/i;

function isFacebookHost(hostname: string): boolean {
  return /(^|\.)(facebook\.com|fb\.com|fbclid\.com)$/i.test(hostname);
}

/** Official MacEwan checkout — tracking query strings are never kept. */
export function canonicalizeTicketUrl(value?: string | null): string {
  const raw = (value ?? "").trim();
  if (!raw) return DEFAULT_TICKET_URL;

  try {
    const first = new URL(raw);
    let candidate = raw;
    if (isFacebookHost(first.hostname)) {
      const nested = first.searchParams.get("u") || first.searchParams.get("href");
      if (nested) candidate = nested;
    }

    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return DEFAULT_TICKET_URL;
    }

    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAM.test(key) || key.toLowerCase().startsWith("utm_")) {
        url.searchParams.delete(key);
      }
    }

    if (
      /(^|\.)purchase\.macewan\.ca$/i.test(url.hostname) &&
      /EventAvailability/i.test(url.pathname)
    ) {
      const eventId = url.searchParams.get("EventId") || url.searchParams.get("eventId");
      const clean = new URL(`${url.origin}${url.pathname}`);
      if (eventId) clean.searchParams.set("EventId", eventId);
      return clean.toString();
    }

    return url.toString();
  } catch {
    return DEFAULT_TICKET_URL;
  }
}
