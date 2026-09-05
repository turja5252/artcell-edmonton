import path from "path";

import type { LeadAttachment } from "@/lib/types";
import { EXT_MIME, mediaRelativePath, resolveAttachmentMime, resolveMediaMime } from "@/lib/media-types";
import {
  deleteBinaryFile,
  deletePrefix,
  readBinaryFile,
  writeBinaryFile,
} from "@/lib/persist";
import { createHash, randomBytes } from "crypto";

export {
  assertAllowedAttachment,
  assertAllowedMedia,
  isPdfMime,
  isPhotoMime,
  isVideoMime,
  MAX_ATTACHMENT_BYTES,
  MAX_MEDIA_BLOB_BYTES,
  MAX_MEDIA_SERVER_BYTES,
  mediaRelativePath,
  newMediaId,
  resolveMediaMime as resolveMimeType,
  safeDownloadName,
} from "@/lib/media-types";

function sanitizeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function attachmentExt(fileName: string): string {
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
    `${sanitizeId(attachmentId)}${attachmentExt(fileName)}`
  );
}

export function newAttachmentId(): string {
  return `att-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
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
    mimeType || resolveAttachmentMime(fileName, "") || "application/octet-stream"
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
  const relative = mediaRelativePath(mediaId, fileName, mimeType);
  await writeBinaryFile(
    relative,
    bytes,
    mimeType || resolveMediaMime(fileName, "") || "application/octet-stream"
  );
  return relative;
}

export async function readMediaFile(item: {
  id: string;
  fileName: string;
  mimeType?: string;
}): Promise<Buffer> {
  return readBinaryFile(mediaRelativePath(item.id, item.fileName, item.mimeType));
}

export async function deleteMediaFile(item: {
  id: string;
  fileName: string;
  mimeType?: string;
}) {
  await deleteBinaryFile(mediaRelativePath(item.id, item.fileName, item.mimeType));
}

export function contentHash(bytes: Buffer): string {
  return createHash("sha1").update(bytes).digest("hex").slice(0, 12);
}
