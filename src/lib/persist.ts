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

export async function readJsonFile<T>(relativePath: string, fallback: T): Promise<T> {
  if (useBlobStore()) {
    const pathname = `${PREFIX}/${relativePath.replace(/^\/+/, "")}`;
    const result = await get(pathname, { access: "public", useCache: false });
    if (!result?.stream) {
      // Seed blob from local repo file on first deploy if present.
      const local = await readLocalJson<T>(relativePath);
      if (local !== undefined) {
        await writeJsonFile(relativePath, local);
        return local;
      }
      return fallback;
    }
    const text = (await streamToBuffer(result.stream)).toString("utf8");
    return JSON.parse(text) as T;
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
    if (!result?.stream) throw new Error("File not found");
    return streamToBuffer(result.stream);
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
