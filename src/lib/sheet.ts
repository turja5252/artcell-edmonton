const SHEET_CSV =
  "https://docs.google.com/spreadsheets/d/1v85LqFr8duSQ-eG0rvwGZtf_v-n4SZoL3xbgDe8itsI/export?format=csv&gid=0";

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

export async function fetchSheetRows(): Promise<
  { company: string; assignedTo: string | null }[]
> {
  const response = await fetch(SHEET_CSV, {
    cache: "no-store",
    headers: { "User-Agent": "ArtcellEdmontonDashboard/1.0" },
  });
  if (!response.ok) {
    throw new Error(`Could not read the Google Sheet (${response.status})`);
  }
  const text = await response.text();
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const [, ...rows] = lines;
  return rows
    .map((line) => parseCsvLine(line))
    .filter((cells) => cells[0])
    .map((cells) => ({
      company: cells[0],
      assignedTo: cells[1] || null,
    }));
}
