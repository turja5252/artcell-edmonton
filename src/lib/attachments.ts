import path from "path";

import type { LeadAttachment } from "@/lib/types";
import {
  deleteBinaryFile,
  deletePrefix,
  readBinaryFile,
  writeBinaryFile,
} from "@/lib/persist";
import { createHash, randomBytes } from "crypto";

export const MAX_ATTACHMENT_BYTES = 12 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

const EXT_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".pdf": "application/pdf",
};

function sanitizeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function extOf(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  return EXT_MIME[ext] ? ext : "";
}

export function attachmentRelativePath(
  leadId: string,
  attachmentId: string,
  fileName: string
): string {
  return path.posix.join(
    "uploads/leads",
    sanitizeId(leadId),
    `${sanitizeId(attachmentId)}${extOf(fileName)}`
  );
}

export function mediaRelativePath(mediaId: string, fileName: string): string {
  return path.posix.join("media", `${sanitizeId(mediaId)}${extOf(fileName)}`);
}

export function isPhotoMime(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

export function isPdfMime(mimeType: string): boolean {
  return mimeType === "application/pdf";
}

export function resolveMimeType(fileName: string, mimeType: string): string | null {
  const normalized = (mimeType || "").toLowerCase().trim();
  if (ALLOWED_MIME.has(normalized)) {
    return normalized === "image/jpg" ? "image/jpeg" : normalized;
  }
  const fromExt = EXT_MIME[path.extname(fileName).toLowerCase()];
  return fromExt ?? null;
}

export function assertAllowedAttachment(fileName: string, mimeType: string, size: number) {
  if (size <= 0) throw new Error("Empty file");
  if (size > MAX_ATTACHMENT_BYTES) throw new Error("File is too large (max 12 MB)");
  const resolved = resolveMimeType(fileName, mimeType);
  if (!resolved) throw new Error("Only photos and PDFs are allowed");
  return resolved;
}

export function newAttachmentId(): string {
  return `att-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
}

export function newMediaId(): string {
  return `media-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
}

export function safeDownloadName(fileName: string): string {
  return fileName.replace(/[\\/:*?"<>|]+/g, "_").trim() || "file";
}

export async function ensureLeadUploadDir(_leadId: string) {
  // no-op: directories are created on write for both local and blob stores
}

export async function removeLeadUploadDir(leadId: string) {
  await deletePrefix(`uploads/leads/${sanitizeId(leadId)}`);
}

export async function writeAttachmentFile(
  leadId: string,
  attachmentId: string,
  fileName: string,
  bytes: Buffer,
  mimeType?: string
) {
  const relative = attachmentRelativePath(leadId, attachmentId, fileName);
  await writeBinaryFile(
    relative,
    bytes,
    mimeType || resolveMimeType(fileName, "") || "application/octet-stream"
  );
  return relative;
}

export async function readAttachmentFile(
  leadId: string,
  attachment: LeadAttachment
): Promise<Buffer> {
  return readBinaryFile(
    attachmentRelativePath(leadId, attachment.id, attachment.fileName)
  );
}

export async function deleteAttachmentFile(leadId: string, attachment: LeadAttachment) {
  await deleteBinaryFile(
    attachmentRelativePath(leadId, attachment.id, attachment.fileName)
  );
}

export async function writeMediaFile(
  mediaId: string,
  fileName: string,
  bytes: Buffer,
  mimeType?: string
) {
  const relative = mediaRelativePath(mediaId, fileName);
  await writeBinaryFile(
    relative,
    bytes,
    mimeType || resolveMimeType(fileName, "") || "application/octet-stream"
  );
  return relative;
}

export async function readMediaFile(item: {
  id: string;
  fileName: string;
}): Promise<Buffer> {
  return readBinaryFile(mediaRelativePath(item.id, item.fileName));
}

export async function deleteMediaFile(item: { id: string; fileName: string }) {
  await deleteBinaryFile(mediaRelativePath(item.id, item.fileName));
}

export function contentHash(bytes: Buffer): string {
  return createHash("sha1").update(bytes).digest("hex").slice(0, 12);
}
