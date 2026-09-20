import { daysUntilConcert, normalizeConcertDate } from "@/lib/concert-date";

export type McSpeaker = "TN" | "RS" | "BOTH";

export type McLine = {
  speaker: Exclude<McSpeaker, "BOTH">;
  text: string;
};

export type McCue = {
  id: string;
  speaker: McSpeaker;
  title: string;
  script: string;
  scriptBn?: string;
  note?: string;
  /** Two-color tandem lines — pink RS / blue TN on the same cue. */
  lines?: McLine[];
};

export type McChapter = {
  id: string;
  number: number;
  title: string;
  clock: string;
  /** Minutes from midnight, America/Edmonton. */
  startMin: number;
  endMin: number;
  summary: string;
  cues: McCue[];
};

export type SponsorRow = {
  tier: string;
  name: string;
  note?: string;
};

export const MC_TIMEZONE = "America/Edmonton";

export const SPONSORS: SponsorRow[] = [
  { tier: "Title", name: "Spectrum Family Law", note: "Ayesha’s team" },
  { tier: "Platinum", name: "Link Insurance Glenbrook" },
  { tier: "Platinum", name: "3MT Property Ventures" },
  { tier: "Silver", name: "Swodeshi Immigration Service" },
  { tier: "Silver", name: "Elite Integrity Service", note: "Tanzim’s employer" },
  { tier: "Silver", name: "KETEK", note: "Raiyan’s employer" },
  { tier: "Silver", name: "Mahbub Mollah — Realtor" },
  { tier: "Bronze", name: "Mohsin Alam — Realtor" },
  { tier: "Bronze", name: "Top Donair and Poutine" },
  { tier: "Bronze", name: "Daily Bazar" },
  { tier: "Digital media", name: "DEXCEL MEDIA" },
  { tier: "Media", name: "Imran Kabir Photography" },
  { tier: "Promotional", name: "BCCB — Bangladeshi Canadian-Canadian Bangladeshi" },
  { tier: "Community", name: "Great Canadian Butcher" },
];

export const SPONSOR_SPEECHES: { company: string; speakers: string }[] = [
  { company: "Spectrum Family Law — Title", speakers: "Conan Taylor and Ayesha Siddiqua" },
  { company: "Link Insurance Glenbrook — Platinum", speakers: "Fardin Islam" },
  { company: "3MT Property Ventures — Platinum", speakers: "Ask who is walking up" },
];

export const THANKS = {
  sound: "Shihab Bhai",
  dhakaArchive: ["Raiyan", "Suddho", "Tahiat", "Jamal"],
  bccb: "Khaled Bari (Novel)",
  photo: "Imran Kabir",
  digital: "DEXCEL MEDIA — still need the person’s name",
  volunteers: [
    "Sathi Saha",
    "Fahim",
    "Navid",
    "Mouri",
    "Shenin",
    "Simran",
    "Shihab",
    "Muntasir",
  ],
};

function min(hour: number, minute = 0): number {
  return hour * 60 + minute;
}

function sponsorSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function spokenSponsor(row: SponsorRow): string {
  if (!row.note || /employer/i.test(row.note)) return row.name;
  return `${row.name} — ${row.note}`;
}

function sponsorCues(): McCue[] {
  const speeches: Record<string, string> = {
    "Spectrum Family Law": "Conan Taylor and Ayesha Siddiqua — come through.",
    "Link Insurance Glenbrook": "Fardin Islam — come through.",
    "3MT Property Ventures": "Give them a real Edmonton welcome.",
  };
  const extraNotes: Record<string, string> = {
    "3MT Property Ventures": "No speaker name on the sheet. Confirm who walks up.",
  };
  return SPONSORS.map((row) => {
    const speech = speeches[row.name];
    const extra = extraNotes[row.name];
    const lines: McLine[] = [
      { speaker: "TN", text: `${row.tier} sponsor.` },
      { speaker: "RS", text: `${spokenSponsor(row)}.` },
    ];
    if (speech) lines.push({ speaker: "TN", text: speech });
    return {
      id: `sponsors-${sponsorSlug(row.name)}`,
      speaker: "BOTH",
      title: row.name,
      script: "",
      lines,
      note: extra,
    };
  });
}

export const MC_CHAPTERS: McChapter[] = [
  {
    id: "open",
    number: 1,
    title: "Opening",
    clock: "6:30 PM",
    startMin: min(18, 30),
    endMin: min(18, 40),
    summary: "TN and RS walk on. Welcome the room, paint Edmonton, find the students, then two minutes of house rules.",
    cues: [
      {
        id: "open-enter",
        speaker: "BOTH",
        title: "Enter together",
        script:
          "Walk on together. Do not rush the first look. Let the room see you, then take the mic.",
      },
      {
        id: "open-welcome",
        speaker: "BOTH",
        title: "Welcome",
        script:
          "Edmonton — welcome. You made it. Tonight this hall is a little piece of Dhaka and a whole lot of this city. Artcell is here. You are here. That is the whole story.",
      },
      {
        id: "open-city",
        speaker: "RS",
        title: "Paint the city",
        script:
          "Let me talk about this city for a second. Edmonton is a festival city. A river city. The capital — and it actually shows up for culture. Diversity is not a slogan in this room. It is the people sitting next to you. Tonight Edmonton painted itself for Artcell.",
      },
      {
        id: "open-audience",
        speaker: "TN",
        title: "Find the audience",
        script:
          "We want to know who is in this room. Students — if this is your night, make some noise. University of Alberta. MacEwan. If Artcell raised you, this is the cheer they came for. Edmonton, wake this band up.",
      },
      {
        id: "open-house-rs",
        speaker: "RS",
        title: "Housekeeping — safety",
        script:
          "Two minutes, then we let the night go. Nearest exit is the one closest to you — use it if you have to leave. Muster point is the posted meeting place outside. If a fire alarm sounds, that is not part of the show. Washrooms are just outside the hall.",
        note: "Point as you say it. Two minutes, not a lecture.",
      },
      {
        id: "open-house-tn",
        speaker: "TN",
        title: "Housekeeping — the room",
        script:
          "A proud Bangladeshi night also means we take care of this building. Food and drink stay out of the foyer and the hall. Tim Hortons and the restaurants are right outside when you step out. Leave this place cleaner than we found it. Respect the room. Respect each other. Then we make some noise.",
      },
    ],
  },
  {
    id: "outline",
    number: 2,
    title: "Night outline",
    clock: "6:40 PM",
    startMin: min(18, 40),
    endMin: min(18, 45),
    summary: "Shape the night in fluid language — not a schedule reading. Thank sponsors, then bring Nick for five minutes.",
    cues: [
      {
        id: "outline-shape",
        speaker: "RS",
        title: "How the night moves",
        script:
          "We are not going to read you a clock. Here is the shape of the night. First, Dhaka Archive takes us home — Edmonton’s own, loud and close. Then we stop for the people who built this room: our sponsors. A short breath. After that, Artcell. First hour. Fifteen minutes so you can exist as humans. Then Artcell again, until the lights give up. Stay with us. The good part is always after people think they can wander.",
      },
      {
        id: "outline-sponsors",
        speaker: "TN",
        title: "Why the sponsors matter",
        script:
          "None of this room is an accident. These are Canadian businesses saying a Bangladeshi night belongs in this city. They did not just write a cheque. They stood behind the night. That is integration — not a speech about Canada. After Dhaka Archive, I call the level. RS reads every name.",
        note: "Do not read the list here. Names are on RS’s pink lines in Sponsor showcase.",
      },
      {
        id: "outline-nick",
        speaker: "TN",
        title: "Bring Nick",
        script:
          "Before the first band, I want to bring someone out. Nick — come through. Give him the room for five minutes.",
        note: "Nick has five minutes. Stay visible so you can take the mic back.",
      },
    ],
  },
  {
    id: "archive",
    number: 3,
    title: "Dhaka Archive",
    clock: "6:45 PM",
    startMin: min(18, 45),
    endMin: min(19, 30),
    summary: "RS tells the origin in Bangla. TN adds the swag. Then you leave the stage to them until 7:30.",
    cues: [
      {
        id: "archive-rs",
        speaker: "RS",
        title: "Introduce Dhaka Archive",
        script:
          "Read the Bangla as written. Slow on the names. Land the last line and hold for the cheer.",
        scriptBn:
          "অনেক বছর আগে, ধানমন্ডি ৩২-এ দুই বন্ধু মিলে বাজাতো তাদের প্রিয় সব গান—Artcell, Warfaze, Nemesis আর বাংলাদেশের রক মিউজিকের সেই গানগুলো, যেগুলো শুনেই তারা বড় হয়েছে।\n\nতখন তারা জানতো না, সেই ছোট ছোট জ্যাম সেশন থেকেই একদিন শুরু হবে আরও বড় একটা গল্প।\n\nঢাকার মিউজিক আর স্মৃতি থেকে অনুপ্রাণিত, কিন্তু Edmonton-এ — University of Alberta-এ — গড়ে ওঠা Dhaka Archives হলো চার বন্ধুর গল্প: Raiyan, Suddho, Tahiat আর Jamal — যাদের একসাথে করেছে মিউজিকের প্রতি ভালোবাসা।\n\nআর আজ রাতে সেই গল্পটা যেন একটা বৃত্ত পূর্ণ করবে।\n\nযে Artcell-এর গান বাজিয়ে তাদের পথচলার একটা অংশ শুরু হয়েছিল, আজ Edmonton-এ সেই Artcell-এর সাথেই একই মঞ্চ শেয়ার করবে Dhaka Archives!\n\nEdmonton, আওয়াজ হোক!\nআজ একই মঞ্চে — ARTCELL × DHAKA ARCHIVES!",
        note: "Tomorrow language is gone. This is tonight.",
      },
      {
        id: "archive-tn",
        speaker: "TN",
        title: "Swag and style",
        script:
          "That is Dhaka Archive. Raiyan, Suddho, Tahiat, Jamal. Four friends, University of Alberta, and a whole lot of swag. This is the style Edmonton grew — loud, tight, and unafraid of the songs that raised them. Give it up. We will see you after.",
      },
      {
        id: "archive-exit",
        speaker: "BOTH",
        title: "Exit",
        script:
          "Hand the stage. Walk off together. They have the room until 7:30.",
      },
    ],
  },
  {
    id: "sponsors",
    number: 4,
    title: "Sponsor showcase",
    clock: "7:30 PM",
    startMin: min(19, 30),
    endMin: min(20, 0),
    summary: "Tandem: TN (blue) calls the level. RS (pink) reads the company name. Title and platinum then walk up. Call the stretch so Artcell does not open to an empty floor.",
    cues: [
      {
        id: "sponsors-open",
        speaker: "RS",
        title: "Open the showcase",
        script:
          "Dhaka Archive, thank you. Before Artcell walks out, we stop for the people who made this hall possible. If you sponsored this night, you are part of the band as far as we are concerned. Tanzim calls the level. I read the name.",
      },
      ...sponsorCues(),
      {
        id: "sponsors-recall",
        speaker: "TN",
        title: "Stretch — then come back",
        script:
          "We are going to take a short stretch. Artcell is about to walk out. If you are not in your seat for that opening, you will miss the first note — and that is a story you do not want. Be back on time. We will call you back.",
      },
    ],
  },
  {
    id: "artcell",
    number: 5,
    title: "Artcell",
    clock: "8:00 PM",
    startMin: min(20, 0),
    endMin: min(22, 15),
    summary: "Short underground story. Four songs as bloodline, not a Wikipedia page. Bring them out. Hold the 9:00 stretch and the 9:15 recall.",
    cues: [
      {
        id: "artcell-story",
        speaker: "TN",
        title: "The underground, short",
        script:
          "Before the posters, they were an underground band that wrote the map. Poth Chola. Dhushor Shomoy. Oniket Prantor. Dukkho Bilash. That is the bloodline. That is why this room is full.",
      },
      {
        id: "artcell-encore",
        speaker: "TN",
        title: "Bring Artcell out",
        script:
          "Edmonton — this is the encore they flew for. I need this room louder than the amps. Artcell. Come on.",
      },
      {
        id: "artcell-break",
        speaker: "TN",
        title: "9:00 — fifteen minutes",
        script:
          "Fifteen minutes. Washrooms, air, water. 9:15 we start again. Do not make Artcell wait on an empty floor.",
        note: "Say this when Part 1 ends. Point to the time.",
      },
      {
        id: "artcell-recall",
        speaker: "TN",
        title: "9:15 — they are back",
        script:
          "If you can hear me in the foyer — Artcell is walking back on. Get in here. Part two. Edmonton, stay standing.",
      },
    ],
  },
  {
    id: "close",
    number: 6,
    title: "Closing",
    clock: "10:15 PM",
    startMin: min(22, 15),
    endMin: min(23, 30),
    summary: "Vote of thanks, then everyone on stage — one family photo with Artcell. Do not rush the names.",
    cues: [
      {
        id: "close-thanks",
        speaker: "TN",
        title: "Vote of thanks",
        script:
          "Before we let the lights win — thank you. Sound: Shihab Bhai. Dhaka Archive: Raiyan, Suddho, Tahiat, Jamal. BCCB: Khaled Bari. On the lens: Imran Kabir. DEXCEL MEDIA. And the volunteers who ran this building: Sathi Saha, Fahim, Navid, Mouri, Shenin, Simran, Shihab, Muntasir. Every sponsor who said yes. You made a Bangladeshi night feel like it belongs in Edmonton.",
        note: "DEXCEL MEDIA still needs a person’s name. Add it if you get it before 10:15.",
      },
      {
        id: "close-photo",
        speaker: "BOTH",
        title: "Family photo",
        script:
          "Sponsors. Team. Band. I need you on this stage. One picture. Artcell in the middle. Edmonton, stay put. This is the family.",
      },
    ],
  },
];

function zoneParts(now: Date, timeZone = MC_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { hour: read("hour"), minute: read("minute"), second: read("second") };
}

export function minutesInZone(now = new Date(), timeZone = MC_TIMEZONE): number {
  const { hour, minute } = zoneParts(now, timeZone);
  return hour * 60 + minute;
}

export function secondsInZone(now = new Date(), timeZone = MC_TIMEZONE): number {
  const { hour, minute, second } = zoneParts(now, timeZone);
  return hour * 3600 + minute * 60 + second;
}

export function formatEdmontonClock(now = new Date(), withSeconds = false): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MC_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    second: withSeconds ? "2-digit" : undefined,
  }).format(now);
}

export function formatShowDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function chapterAtMinute(minute: number): McChapter {
  const current = MC_CHAPTERS.find((chapter) => minute >= chapter.startMin && minute < chapter.endMin);
  if (current) return current;
  if (minute < MC_CHAPTERS[0].startMin) return MC_CHAPTERS[0];
  return MC_CHAPTERS[MC_CHAPTERS.length - 1];
}

export function chapterAtSecond(second: number): McChapter | null {
  return (
    MC_CHAPTERS.find(
      (chapter) => second >= chapter.startMin * 60 && second < chapter.endMin * 60
    ) ?? null
  );
}

export type ShowClockState = {
  clock: string;
  headline: string;
  detail: string;
  remainingSec: number | null;
  progress: number | null;
  chapter: McChapter | null;
  next: McChapter | null;
  phase: "before" | "live" | "after";
};

function tzOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour"),
    read("minute"),
    read("second")
  );
  return asUtc - date.getTime();
}

/** UTC ms for a civil wall time in America/Edmonton. */
export function zonedCivilTimeMs(
  isoDate: string,
  hour: number,
  minute = 0,
  second = 0,
  timeZone = MC_TIMEZONE
): number {
  const date = normalizeConcertDate(isoDate);
  const utcGuess = Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
    hour,
    minute,
    second
  );
  const adjusted = utcGuess - tzOffsetMs(new Date(utcGuess), timeZone);
  return utcGuess - tzOffsetMs(new Date(adjusted), timeZone);
}

export function showClockState(now = new Date(), concertDate?: string): ShowClockState {
  const clock = formatEdmontonClock(now, true);
  const days = concertDate ? daysUntilConcert(concertDate, now, MC_TIMEZONE) : 0;

  if (days > 0) {
    const openingMin = MC_CHAPTERS[0].startMin;
    const opening = zonedCivilTimeMs(
      concertDate!,
      Math.floor(openingMin / 60),
      openingMin % 60
    );
    const remainingSec = Math.max(0, Math.floor((opening - now.getTime()) / 1000));
    return {
      clock,
      headline: formatShowDuration(remainingSec),
      detail: `Until ${MC_CHAPTERS[0].clock} opening`,
      remainingSec,
      progress: null,
      chapter: null,
      next: MC_CHAPTERS[0],
      phase: "before",
    };
  }

  if (days < 0) {
    return {
      clock,
      headline: "Closed",
      detail: "Show night is over",
      remainingSec: null,
      progress: 1,
      chapter: MC_CHAPTERS[MC_CHAPTERS.length - 1],
      next: null,
      phase: "after",
    };
  }

  const second = secondsInZone(now);
  const first = MC_CHAPTERS[0];
  const last = MC_CHAPTERS[MC_CHAPTERS.length - 1];
  const live = chapterAtSecond(second);

  if (second < first.startMin * 60) {
    const remainingSec = first.startMin * 60 - second;
    return {
      clock,
      headline: formatShowDuration(remainingSec),
      detail: `Until ${first.clock} ${first.title}`,
      remainingSec,
      progress: null,
      chapter: null,
      next: first,
      phase: "before",
    };
  }

  if (live) {
    const remainingSec = live.endMin * 60 - second;
    const span = Math.max(1, (live.endMin - live.startMin) * 60);
    const elapsed = second - live.startMin * 60;
    const index = MC_CHAPTERS.findIndex((chapter) => chapter.id === live.id);
    const next = MC_CHAPTERS[index + 1] ?? null;
    return {
      clock,
      headline: formatShowDuration(remainingSec),
      detail: next
        ? `${live.title} · next ${next.clock} ${next.title}`
        : `${live.title} · last block`,
      remainingSec,
      progress: Math.min(1, Math.max(0, elapsed / span)),
      chapter: live,
      next,
      phase: "live",
    };
  }

  if (second >= last.endMin * 60) {
    return {
      clock,
      headline: "Closed",
      detail: "Thanks and family photo",
      remainingSec: null,
      progress: 1,
      chapter: last,
      next: null,
      phase: "after",
    };
  }

  const next = MC_CHAPTERS.find((chapter) => second < chapter.startMin * 60) ?? last;
  const remainingSec = Math.max(0, next.startMin * 60 - second);
  return {
    clock,
    headline: formatShowDuration(remainingSec),
    detail: `Until ${next.clock} ${next.title}`,
    remainingSec,
    progress: null,
    chapter: null,
    next,
    phase: "before",
  };
}

export function speakerLabel(speaker: McSpeaker): string {
  if (speaker === "TN") return "TN · Tanzim";
  if (speaker === "RS") return "RS";
  return "TN + RS";
}

export function cueMatchesSpeaker(cue: McCue, filter: "all" | McSpeaker): boolean {
  if (filter === "all") return true;
  if (cue.lines?.some((line) => line.speaker === filter)) return true;
  if (cue.speaker === "BOTH") return true;
  return cue.speaker === filter;
}
