import type { SetlistCue } from "@/lib/types";

function toSeconds(stamp: string): number {
  const parts = stamp.split(":").map((part) => Number(part));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] ?? 0;
}

function withTime(url: string, seconds: number): string {
  const parsed = new URL(url);
  parsed.searchParams.delete("list");
  parsed.searchParams.delete("start_radio");
  parsed.searchParams.delete("pp");
  parsed.searchParams.set("t", `${seconds}s`);
  return parsed.toString();
}

const RAW = [
  {
    label: "Dukkho Bilash Outro",
    timestamp: "8:15",
    url: "https://www.youtube.com/watch?v=xSue3Ckaoos",
  },
  {
    label: "Onno Shomoy Intro",
    timestamp: "10:52",
    url: "https://www.youtube.com/watch?v=xSue3Ckaoos",
  },
  {
    label: "Onno Shomoy Instrumental Section",
    timestamp: "1:42",
    url: "https://www.youtube.com/watch?v=v6SWr2UeYs4",
  },
  {
    label: "Onno Shomoy Outro",
    timestamp: "4:22",
    url: "https://www.youtube.com/watch?v=v6SWr2UeYs4",
  },
  {
    label: "Dhushor Shomoy Final Chorus",
    timestamp: "6:18",
    url: "https://www.youtube.com/watch?v=eo4Zj-7Ex4o",
  },
  {
    label: "Rahur Ghrash Chorus",
    timestamp: "4:52",
    url: "https://www.youtube.com/watch?v=7FupQWRuqSc",
  },
  {
    label: "Rahur Grash Outro Instrumental",
    timestamp: "6:39",
    url: "https://www.youtube.com/watch?v=7FupQWRuqSc",
  },
  {
    label: "Bhul Jonmo Chorus",
    timestamp: "2:02",
    url: "https://www.youtube.com/watch?v=z47nnlHkMIc",
  },
  {
    label: "Utshober Utshahe",
    timestamp: "4:15",
    url: "https://www.youtube.com/watch?v=RpEFOwsHEmE",
  },
  {
    label: "Chile Kothar Sepai Solo",
    timestamp: "3:11",
    url: "https://www.youtube.com/watch?v=xI_Fa-wpGgw",
  },
  {
    label: "Chile Kothar Shepai Instrumental",
    timestamp: "4:31",
    url: "https://www.youtube.com/watch?v=ZI0TYzNuSq4",
  },
] as const;

export const SETLIST: SetlistCue[] = RAW.map((cue, index) => {
  const seconds = toSeconds(cue.timestamp);
  return {
    id: `cue-${index + 1}`,
    label: cue.label,
    timestamp: cue.timestamp,
    seconds,
    url: withTime(cue.url, seconds),
  };
});
