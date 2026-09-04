import { promises as fs } from "fs";
import path from "path";

import { del, get, list, put } from "@vercel/blob";

const PREFIX = "artcell";

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

async function readBlobJson<T>(pathname: string): Promise<T | undefined> {
  const result = await get(pathname, { access: "public", useCache: false });
  if (result?.stream) {
    return parseJsonBuffer(await streamToBuffer(result.stream));
  }

  // get() can miss intermittently; fall back to listing the exact path.
  const listed = await list({ prefix: pathname, limit: 10 });
  const match = listed.blobs.find(
    (blob) => blob.pathname === pathname || blob.pathname.endsWith(`/${pathname}`)
  );
  if (!match) return undefined;

  const response = await fetch(match.url, { cache: "no-store" });
  if (!response.ok) return undefined;
  return (await response.json()) as T;
}

async function markSeeded(relativePath: string) {
  const marker = `${PREFIX}/_seeded/${relativePath.replace(/^\/+/, "")}`;
  await put(marker, "1", {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "text/plain",
    cacheControlMaxAge: 0,
  });
}

async function wasSeeded(relativePath: string): Promise<boolean> {
  const marker = `${PREFIX}/_seeded/${relativePath.replace(/^\/+/, "")}`;
  const result = await get(marker, { access: "public", useCache: false });
  if (result?.stream) return true;
  const listed = await list({ prefix: marker, limit: 5 });
  return listed.blobs.some(
    (blob) => blob.pathname === marker || blob.pathname.endsWith(`/${marker}`)
  );
}

export async function readJsonFile<T>(relativePath: string, fallback: T): Promise<T> {
  if (useBlobStore()) {
    const pathname = `${PREFIX}/${relativePath.replace(/^\/+/, "")}`;
    const existing = await readBlobJson<T>(pathname);
    if (existing !== undefined) return existing;

    // Already seeded once — never overwrite live data from the git checkout again.
    // That was restoring deleted teammates (e.g. Novel) on every blob miss.
    if (await wasSeeded(relativePath)) {
      return fallback;
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
  if (useBlobStore()) {
    const pathname = `${PREFIX}/${relativePath.replace(/^\/+/, "")}`;
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
    const pathname = `${PREFIX}/${relativePath.replace(/^\/+/, "")}`;
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
    const pathname = `${PREFIX}/${relativePath.replace(/^\/+/, "")}`;
    const result = await get(pathname, { access: "public", useCache: false });
    if (result?.stream) return streamToBuffer(result.stream);
    const listed = await list({ prefix: pathname, limit: 10 });
    const match = listed.blobs.find(
      (blob) => blob.pathname === pathname || blob.pathname.endsWith(`/${pathname}`)
    );
    if (!match) throw new Error("File not found");
    const response = await fetch(match.url, { cache: "no-store" });
    if (!response.ok) throw new Error("File not found");
    return Buffer.from(await response.arrayBuffer());
  }
  return fs.readFile(path.join(process.cwd(), "data", relativePath));
}

export async function deleteBinaryFile(relativePath: string): Promise<void> {
  if (useBlobStore()) {
    const pathname = `${PREFIX}/${relativePath.replace(/^\/+/, "")}`;
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
