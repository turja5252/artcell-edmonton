import { promises as fs } from "fs";
import path from "path";

import { del, get, head, list, put } from "@vercel/blob";

const PREFIX = "artcell";

/** Live board files. After first seed, never rewrite these from git `data/*.json`. */
const LIVE_JSON = new Set(["leads.json", "guests.json", "members.json", "settings.json"]);

const memoryValues = new Map<string, unknown>();
const seededMemory = new Set<string>();

export function useBlobStore(): boolean {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN?.trim() ||
      process.env.BLOB_STORE_ID?.trim() ||
      process.env.VERCEL_OIDC_TOKEN?.trim()
  );
}

function assertWritableStore(action: string) {
  if (useBlobStore()) return;
  if (process.env.VERCEL) {
    throw new Error(
      "Storage not connected yet. In Vercel → Storage, create a Blob store, connect it to this project, then Redeploy."
    );
  }
  void action;
}

function mapFsWriteError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (/EROFS|read-only file system/i.test(message) || process.env.VERCEL) {
    throw new Error(
      "Storage not connected yet. In Vercel → Storage, create a Blob store, connect it to this project, then Redeploy."
    );
  }
  throw error instanceof Error ? error : new Error(message);
}

function fileKey(relativePath: string): string {
  return relativePath.replace(/^\/+/, "");
}

function remember<T>(relativePath: string, value: T) {
  const key = fileKey(relativePath);
  memoryValues.set(key, value);
  seededMemory.add(key);
}

function recall<T>(relativePath: string): T | undefined {
  const key = fileKey(relativePath);
  if (!memoryValues.has(key)) return undefined;
  return memoryValues.get(key) as T;
}

async function streamToBuffer(stream: ReadableStream<Uint8Array> | null): Promise<Buffer> {
  if (!stream) return Buffer.alloc(0);
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

async function parseJsonBuffer<T>(buffer: Buffer): Promise<T> {
  return JSON.parse(buffer.toString("utf8")) as T;
}

function samePath(pathname: string, candidate: string): boolean {
  return candidate === pathname || candidate.endsWith(`/${pathname}`);
}

async function fetchJsonUrl<T>(url: string): Promise<T | undefined> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return undefined;
  return (await response.json()) as T;
}

async function listExactBlob(pathname: string) {
  const listed = await list({ prefix: pathname, limit: 20 });
  return listed.blobs.find((blob) => samePath(pathname, blob.pathname));
}

async function readBlobJson<T>(pathname: string): Promise<T | undefined> {
  try {
    const result = await get(pathname, { access: "public", useCache: false });
    if (result?.stream) {
      return parseJsonBuffer(await streamToBuffer(result.stream));
    }
  } catch {
    // get() can throw on a miss or a transient store error
  }

  try {
    const match = await listExactBlob(pathname);
    if (match) {
      const fromList = await fetchJsonUrl<T>(match.url);
      if (fromList !== undefined) return fromList;
    }
  } catch {
    // list() can miss or fail independently of get()
  }

  try {
    const meta = await head(pathname);
    if (meta?.url) {
      const fromHead = await fetchJsonUrl<T>(meta.url);
      if (fromHead !== undefined) return fromHead;
    }
  } catch {
    // head() throws when the pathname is gone
  }

  return undefined;
}

function markerPath(relativePath: string): string {
  return `${PREFIX}/_seeded/${fileKey(relativePath)}`;
}

async function markSeeded(relativePath: string) {
  const key = fileKey(relativePath);
  seededMemory.add(key);
  try {
    await put(markerPath(relativePath), "1", {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "text/plain",
      cacheControlMaxAge: 0,
    });
  } catch {
    // Memory still treats the file as seeded so this process will not re-upload git JSON.
  }
}

async function wasSeeded(relativePath: string): Promise<boolean> {
  const key = fileKey(relativePath);
  if (seededMemory.has(key)) return true;

  const marker = markerPath(relativePath);
  try {
    const result = await get(marker, { access: "public", useCache: false });
    if (result?.stream) {
      seededMemory.add(key);
      return true;
    }
  } catch {
    // marker get() can miss the same way data get() can
  }

  try {
    const exact = await listExactBlob(marker);
    if (exact) {
      seededMemory.add(key);
      return true;
    }
  } catch {
    // continue to a broader list
  }

  try {
    const listed = await list({ prefix: `${PREFIX}/_seeded/`, limit: 100 });
    const found = listed.blobs.some(
      (blob) =>
        samePath(marker, blob.pathname) || blob.pathname.endsWith(`/_seeded/${key}`)
    );
    if (found) {
      seededMemory.add(key);
      return true;
    }
  } catch {
    return seededMemory.has(key);
  }

  return false;
}

export async function readJsonFile<T>(relativePath: string, fallback: T): Promise<T> {
  if (useBlobStore()) {
    const key = fileKey(relativePath);
    const pathname = `${PREFIX}/${key}`;
    const existing = await readBlobJson<T>(pathname);
    if (existing !== undefined) {
      remember(key, existing);
      return existing;
    }

    const cached = recall<T>(key);
    if (cached !== undefined) return cached;

    // Marker or a prior write in this process: never re-upload git `data/*.json`.
    if (await wasSeeded(relativePath)) {
      return fallback;
    }

    // Live board files: if the blob path exists but get() missed, do not treat as first seed.
    if (LIVE_JSON.has(key)) {
      try {
        const live = await listExactBlob(pathname);
        if (live) {
          const recovered = await fetchJsonUrl<T>(live.url);
          if (recovered !== undefined) {
            remember(key, recovered);
            await markSeeded(relativePath);
            return recovered;
          }
          await markSeeded(relativePath);
          return fallback;
        }
      } catch {
        // fall through to first-seed only when the store looks empty
      }
    }

    const local = await readLocalJson<T>(relativePath);
    if (local !== undefined) {
      await writeJsonFile(relativePath, local);
      await markSeeded(relativePath);
      return local;
    }
    await markSeeded(relativePath);
    return fallback;
  }
  const local = await readLocalJson<T>(relativePath);
  return local === undefined ? fallback : local;
}

async function readLocalJson<T>(relativePath: string): Promise<T | undefined> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "data", relativePath), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export async function writeJsonFile(relativePath: string, value: unknown): Promise<void> {
  const body = `${JSON.stringify(value, null, 2)}\n`;
  remember(relativePath, value);
  if (useBlobStore()) {
    const pathname = `${PREFIX}/${fileKey(relativePath)}`;
    await put(pathname, body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 0,
    });
    await markSeeded(relativePath);
    return;
  }
  assertWritableStore("writeJsonFile");
  try {
    const target = path.join(process.cwd(), "data", relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, body, "utf8");
  } catch (error) {
    mapFsWriteError(error);
  }
}

export async function writeBinaryFile(
  relativePath: string,
  bytes: Buffer,
  contentType: string
): Promise<void> {
  if (useBlobStore()) {
    const pathname = `${PREFIX}/${fileKey(relativePath)}`;
    await put(pathname, bytes, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType,
      cacheControlMaxAge: 60 * 60 * 24 * 30,
    });
    return;
  }
  assertWritableStore("writeBinaryFile");
  try {
    const target = path.join(process.cwd(), "data", relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes);
  } catch (error) {
    mapFsWriteError(error);
  }
}

export async function readBinaryFile(relativePath: string): Promise<Buffer> {
  if (useBlobStore()) {
    const pathname = `${PREFIX}/${fileKey(relativePath)}`;
    try {
      const result = await get(pathname, { access: "public", useCache: false });
      if (result?.stream) return streamToBuffer(result.stream);
    } catch {
      // fall through to list / head
    }
    const match = await listExactBlob(pathname);
    if (match) {
      const response = await fetch(match.url, { cache: "no-store" });
      if (response.ok) return Buffer.from(await response.arrayBuffer());
    }
    try {
      const meta = await head(pathname);
      const response = await fetch(meta.url, { cache: "no-store" });
      if (response.ok) return Buffer.from(await response.arrayBuffer());
    } catch {
      // not found
    }
    throw new Error("File not found");
  }
  return fs.readFile(path.join(process.cwd(), "data", relativePath));
}

export async function deleteBinaryFile(relativePath: string): Promise<void> {
  if (useBlobStore()) {
    const pathname = `${PREFIX}/${fileKey(relativePath)}`;
    try {
      await del(pathname);
    } catch {
      // already gone
    }
    return;
  }
  await fs.rm(path.join(process.cwd(), "data", relativePath), { force: true });
}

export async function deletePrefix(relativePrefix: string): Promise<void> {
  if (useBlobStore()) {
    const prefix = `${PREFIX}/${relativePrefix.replace(/^\/+/, "").replace(/\/?$/, "/")}`;
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor });
      if (page.blobs.length) {
        await del(page.blobs.map((blob) => blob.url));
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return;
  }
  await fs.rm(path.join(process.cwd(), "data", relativePrefix), {
    recursive: true,
    force: true,
  });
}
