export type PhoneContact = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
};

type ContactPickerContact = {
  name?: string[];
  tel?: string[];
  email?: string[];
};

type ContactPicker = {
  select: (
    properties: string[],
    options?: { multiple?: boolean }
  ) => Promise<ContactPickerContact[]>;
};

declare global {
  interface Navigator {
    contacts?: ContactPicker;
  }
}

export function contactsPickerSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  return Boolean(navigator.contacts && "select" in navigator.contacts);
}

export function formatImportedPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const ten =
    digits.length === 11 && digits.startsWith("1")
      ? digits.slice(1)
      : digits.length === 10
        ? digits
        : "";
  if (!ten) return raw.trim();
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

export function splitDisplayName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

function fromPickerContact(contact: ContactPickerContact): PhoneContact | null {
  const fullName = (contact.name?.[0] ?? "").trim();
  const phone = formatImportedPhone(contact.tel?.[0] ?? "");
  const email = (contact.email?.[0] ?? "").trim();
  if (!fullName && !phone && !email) return null;
  const { firstName, lastName } = splitDisplayName(fullName || phone || email);
  return { firstName, lastName, phone, email };
}

export async function pickPhoneContacts(): Promise<PhoneContact[]> {
  if (!contactsPickerSupported() || !navigator.contacts) {
    throw new Error("Phone contact picker is not available in this browser");
  }
  const selected = await navigator.contacts.select(["name", "tel", "email"], {
    multiple: true,
  });
  return selected
    .map(fromPickerContact)
    .filter((contact): contact is PhoneContact => Boolean(contact));
}

function decodeVcardValue(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function unfoldVcard(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}

export function parseVcardContacts(text: string): PhoneContact[] {
  const cards = unfoldVcard(text).split(/BEGIN:VCARD/i).slice(1);
  const contacts: PhoneContact[] = [];

  for (const card of cards) {
    const block = card.split(/END:VCARD/i)[0] ?? "";
    let firstName = "";
    let lastName = "";
    let fullName = "";
    let phone = "";
    let email = "";

    for (const rawLine of block.split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;
      const sep = line.indexOf(":");
      if (sep < 0) continue;
      const keyPart = line.slice(0, sep);
      const value = decodeVcardValue(line.slice(sep + 1));
      const key = keyPart.split(";")[0].toUpperCase();

      if (key === "N") {
        const [family = "", given = "", middle = ""] = value.split(";");
        firstName = [given, middle].filter(Boolean).join(" ").trim();
        lastName = family.trim();
      } else if (key === "FN") {
        fullName = value;
      } else if (key === "TEL" && !phone) {
        phone = formatImportedPhone(value);
      } else if (key === "EMAIL" && !email) {
        email = value;
      }
    }

    if (!firstName && !lastName && fullName) {
      const split = splitDisplayName(fullName);
      firstName = split.firstName;
      lastName = split.lastName;
    }
    if (!firstName && !lastName && !phone && !email) continue;
    if (!firstName && !lastName) {
      const split = splitDisplayName(phone || email);
      firstName = split.firstName;
      lastName = split.lastName;
    }
    contacts.push({ firstName, lastName, phone, email });
  }

  return contacts;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

export function parseCsvContacts(text: string): PhoneContact[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const header = parseCsvLine(lines[0]).map((cell) => cell.toLowerCase());
  const looksLikeHeader = header.some((cell) =>
    /first|last|name|phone|mobile|email|e-mail|tel/.test(cell)
  );
  const rows = looksLikeHeader ? lines.slice(1) : lines;
  const headers = looksLikeHeader ? header : [];

  const indexOf = (...names: string[]) =>
    headers.findIndex((cell) => names.some((name) => cell.includes(name)));

  const firstIdx = indexOf("first name", "firstname", "given");
  const lastIdx = indexOf("last name", "lastname", "family", "surname");
  const nameIdx = indexOf("full name", "display name", "name");
  const phoneIdx = indexOf("phone", "mobile", "tel", "cell");
  const emailIdx = indexOf("email", "e-mail");

  const contacts: PhoneContact[] = [];
  for (const line of rows) {
    const cells = parseCsvLine(line);
    if (!cells.some(Boolean)) continue;

    let firstName = firstIdx >= 0 ? cells[firstIdx] ?? "" : "";
    let lastName = lastIdx >= 0 ? cells[lastIdx] ?? "" : "";
    const fullName = nameIdx >= 0 ? cells[nameIdx] ?? "" : "";
    const phone = formatImportedPhone(
      phoneIdx >= 0 ? cells[phoneIdx] ?? "" : cells.length === 2 ? cells[1] : ""
    );
    const email = emailIdx >= 0 ? cells[emailIdx] ?? "" : "";

    if (!firstName && !lastName) {
      const split = splitDisplayName(fullName || cells[0] || "");
      firstName = split.firstName;
      lastName = split.lastName;
    }
    if (!firstName && !lastName && !phone && !email) continue;
    contacts.push({ firstName, lastName, phone, email });
  }
  return contacts;
}

export async function parseContactFile(file: File): Promise<PhoneContact[]> {
  const text = await file.text();
  const name = file.name.toLowerCase();
  if (name.endsWith(".vcf") || text.toUpperCase().includes("BEGIN:VCARD")) {
    return parseVcardContacts(text);
  }
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    return parseCsvContacts(text);
  }
  if (text.toUpperCase().includes("BEGIN:VCARD")) return parseVcardContacts(text);
  return parseCsvContacts(text);
}

export function contactKey(contact: Pick<PhoneContact, "firstName" | "lastName" | "phone">): string {
  return `${contact.firstName}|${contact.lastName}|${contact.phone.replace(/\D/g, "")}`
    .toLowerCase()
    .trim();
}
