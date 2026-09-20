export type McSpeaker = "TN" | "RS" | "BOTH";

export type McCue = {
  id: string;
  speaker: McSpeaker;
  title: string;
  script: string;
  scriptBn?: string;
  note?: string;
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
          "None of this room is an accident. These are Canadian businesses saying a Bangladeshi night belongs in this city. Spectrum Family Law — Ayesha’s team — title sponsor. They did not just write a cheque. They stood behind the night. Platinum: Link Insurance Glenbrook, and 3MT Property Ventures. Silver: Swodeshi Immigration, Elite Integrity Service, KETEK, Mahbub Mollah. Bronze: Mohsin Alam, Top Donair and Poutine, Daily Bazar. DEXCEL MEDIA on the digital side. Imran Kabir on the lens. BCCB carrying community. Great Canadian Butcher in this city’s kitchen. That is integration. Not a speech about Canada — a room full of people who said yes.",
        note: "Glance the list. Do not recite it like a spreadsheet.",
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
    summary: "Thank the room that paid for the night. Title and platinum speak. Then call the stretch — Artcell’s opening cannot start to an empty floor.",
    cues: [
      {
        id: "sponsors-open",
        speaker: "RS",
        title: "Open the showcase",
        script:
          "Dhaka Archive, thank you. Before Artcell walks out, we stop for the people who made this hall possible. If you sponsored this night, you are part of the band as far as we are concerned.",
      },
      {
        id: "sponsors-title",
        speaker: "TN",
        title: "Title — Spectrum Family Law",
        script:
          "Our title sponsor, Spectrum Family Law — Ayesha’s team. Please welcome Conan Taylor and Ayesha Siddiqua.",
      },
      {
        id: "sponsors-link",
        speaker: "TN",
        title: "Platinum — Link Insurance",
        script:
          "Platinum sponsor, Link Insurance Glenbrook. Fardin Islam — come through.",
      },
      {
        id: "sponsors-3mt",
        speaker: "TN",
        title: "Platinum — 3MT",
        script:
          "Platinum sponsor, 3MT Property Ventures. Give them a real Edmonton welcome.",
        note: "No speaker name on the sheet. Confirm who walks up before you say it.",
      },
      {
        id: "sponsors-rest",
        speaker: "TN",
        title: "The rest of the family",
        script:
          "Silver: Swodeshi Immigration Service. Elite Integrity Service. KETEK. Mahbub Mollah. Bronze: Mohsin Alam. Top Donair and Poutine. Daily Bazar. Digital: DEXCEL MEDIA. On the lens: Imran Kabir Photography. Promotional partner: BCCB. Community support: Great Canadian Butcher. This city said yes. Keep that with you.",
      },
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

export function minutesInZone(now = new Date(), timeZone = MC_TIMEZONE): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function formatEdmontonClock(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MC_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(now);
}

export function chapterAtMinute(minute: number): McChapter {
  const current = MC_CHAPTERS.find((chapter) => minute >= chapter.startMin && minute < chapter.endMin);
  if (current) return current;
  if (minute < MC_CHAPTERS[0].startMin) return MC_CHAPTERS[0];
  return MC_CHAPTERS[MC_CHAPTERS.length - 1];
}

export function speakerLabel(speaker: McSpeaker): string {
  if (speaker === "TN") return "TN · Tanzim";
  if (speaker === "RS") return "RS";
  return "TN + RS";
}

export function cueMatchesSpeaker(cue: McCue, filter: "all" | McSpeaker): boolean {
  if (filter === "all") return true;
  if (cue.speaker === "BOTH") return true;
  return cue.speaker === filter;
}
