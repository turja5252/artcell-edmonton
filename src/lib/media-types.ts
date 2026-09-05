/** Shared media rules — safe for client and server. */

export const MAX_ATTACHMENT_BYTES = 12 * 1024 * 1024;
export const MAX_MEDIA_SERVER_BYTES = 80 * 1024 * 1024;
export const MAX_MEDIA_BLOB_BYTES = 500 * 1024 * 1024;
/** Phone clips under this size are never “too large” on Blob. */
export const SMALL_VIDEO_OK_BYTES = 100 * 1024 * 1024;
/** Stay under Vercel Hobby / serverless request body (~4.5 MB). */
export const MAX_SERVERLESS_POST_BYTES = 4 * 1024 * 1024;

export const BLOB_STORE_PREFIX = "artcell";

export const VIDEO_TOO_LARGE_HOST =
  "This video is over the Media upload limit (500 MB). Use a shorter clip.";

export const STORAGE_NOT_CONNECTED = "Storage not connected";

export const VIDEOS_GO_ON_MEDIA =
  "Videos go on the Media tab. Sponsor files are photos and PDFs only.";

export const PHOTO_PDF_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

export const VIDEO_MIME = new Set([
  "video/quicktime",
  "video/x-quicktime",
  "video/mov",
  "video/mp4",
  "video/x-mp4",
  "video/x-m4v",
  "video/m4v",
  "video/webm",
  "video/3gpp",
  "video/3gpp2",
  "video/mpeg",
  "video/avi",
  "video/x-msvideo",
  "video/hevc",
  "video/h264",
]);

export const MEDIA_MIME = new Set([...PHOTO_PDF_MIME, ...VIDEO_MIME]);

export const EXT_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".pdf": "application/pdf",
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".m4v": "video/x-m4v",
  ".webm": "video/webm",
  ".3gp": "video/3gpp",
  ".3g2": "video/3gpp2",
  ".mpg": "video/mpeg",
  ".mpeg": "video/mpeg",
  ".avi": "video/x-msvideo",
};

export const MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "application/pdf": ".pdf",
  "video/quicktime": ".mov",
  "video/x-quicktime": ".mov",
  "video/mov": ".mov",
  "video/mp4": ".mp4",
  "video/x-mp4": ".mp4",
  "video/x-m4v": ".m4v",
  "video/m4v": ".m4v",
  "video/webm": ".webm",
  "video/3gpp": ".3gp",
  "video/3gpp2": ".3g2",
  "video/mpeg": ".mpg",
  "video/avi": ".avi",
  "video/x-msvideo": ".avi",
  "video/hevc": ".mp4",
  "video/h264": ".mp4",
};

/** iOS Photos shows Videos when video/* and .mov/.mp4/.m4v are listed. */
export const MEDIA_FILE_ACCEPT = [
  "image/*",
  "video/*",
  "video/quicktime",
  "video/x-quicktime",
  "video/mp4",
  "video/x-m4v",
  "video/webm",
  "video/3gpp",
  "application/pdf",
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".heic",
  ".heif",
  ".mov",
  ".mp4",
  ".m4v",
  ".webm",
  ".3gp",
  ".avi",
].join(",");

export const MEDIA_ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/*",
  "application/pdf",
  "video/quicktime",
  "video/x-quicktime",
  "video/mov",
  "video/mp4",
  "video/x-mp4",
  "video/x-m4v",
  "video/m4v",
  "video/webm",
  "video/3gpp",
  "video/3gpp2",
  "video/mpeg",
  "video/avi",
  "video/x-msvideo",
  "video/hevc",
  "video/h264",
  "video/*",
  "application/octet-stream",
];

export const MEDIA_ID_RE = /^media-[a-z0-9]+-[a-f0-9]+$/;
export const MEDIA_BLOB_PATH_RE = /^artcell\/media\/[A-Za-z0-9._-]+$/;

export type BlobClientUploadMode = "token" | "presigned";

export type MediaUploadConfig = {
  clientUpload: boolean;
  maxBytes: number;
  vercel: boolean;
  mode?: BlobClientUploadMode | null;
};

export function isAllowedMediaBlobPath(pathname: string, id: string, expected: string): boolean {
  if (pathname === expected) return true;
  if (!MEDIA_BLOB_PATH_RE.test(pathname)) return false;
  const safeId = sanitizeId(id);
  return Boolean(safeId) && pathname.includes(safeId);
}

export function fileExt(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() || fileName;
  const index = base.lastIndexOf(".");
  if (index <= 0) return "";
  return base.slice(index).toLowerCase();
}

export function sanitizeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function safeDownloadName(fileName: string): string {
  return fileName.replace(/[\\/:*?"<>|]+/g, "_").trim() || "file";
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function newMediaId(): string {
  return `media-${Date.now().toString(36)}-${randomHex(3)}`;
}

export function normalizeMediaMime(mimeType: string): string {
  const normalized = (mimeType || "").toLowerCase().trim();
  return normalized === "image/jpg" ? "image/jpeg" : normalized;
}

export function isUnknownFileSize(size: number): boolean {
  return !Number.isFinite(size) || size <= 0;
}

export function resolveMediaMime(fileName: string, mimeType: string): string | null {
  const normalized = normalizeMediaMime(mimeType);
  const fromExt = EXT_MIME[fileExt(fileName)];
  // iOS can pair a video type with a .HEIC name, or a .MOV with image/heic.
  if (normalized.startsWith("video/") || fromExt?.startsWith("video/")) {
    if (VIDEO_MIME.has(normalized)) return normalized;
    if (normalized.startsWith("video/")) return normalized;
    if (fromExt?.startsWith("video/")) return fromExt;
  }
  if (MEDIA_MIME.has(normalized)) return normalized;
  return fromExt ?? null;
}

export function resolveAttachmentMime(fileName: string, mimeType: string): string | null {
  const normalized = normalizeMediaMime(mimeType);
  if (PHOTO_PDF_MIME.has(normalized)) {
    return normalized === "image/jpg" ? "image/jpeg" : normalized;
  }
  const fromExt = EXT_MIME[fileExt(fileName)];
  if (fromExt && PHOTO_PDF_MIME.has(fromExt)) return fromExt;
  return null;
}

export function isPhotoMime(mimeType: string): boolean {
  return normalizeMediaMime(mimeType).startsWith("image/");
}

export function isPdfMime(mimeType: string): boolean {
  return normalizeMediaMime(mimeType) === "application/pdf";
}

export function isVideoMime(mimeType: string): boolean {
  const normalized = normalizeMediaMime(mimeType);
  return normalized.startsWith("video/") || VIDEO_MIME.has(normalized);
}

export function looksLikeVideo(fileName: string, mimeType: string): boolean {
  const normalized = normalizeMediaMime(mimeType);
  if (normalized.startsWith("video/") || VIDEO_MIME.has(normalized)) return true;
  return Boolean(EXT_MIME[fileExt(fileName)]?.startsWith("video/"));
}

export function mediaFileExt(fileName: string, mimeType = ""): string {
  const ext = fileExt(fileName);
  const resolved = resolveMediaMime(fileName, mimeType);
  if (resolved?.startsWith("video/")) {
    if (EXT_MIME[ext]?.startsWith("video/")) return ext;
    if (MIME_EXT[resolved]) return MIME_EXT[resolved];
    return ".mp4";
  }
  if (EXT_MIME[ext]) return ext;
  if (resolved && MIME_EXT[resolved]) return MIME_EXT[resolved];
  return "";
}

export function mediaRelativePath(mediaId: string, fileName: string, mimeType = ""): string {
  return `media/${sanitizeId(mediaId)}${mediaFileExt(fileName, mimeType)}`;
}

export function mediaBlobPathname(mediaId: string, fileName: string, mimeType = ""): string {
  return `${BLOB_STORE_PREFIX}/${mediaRelativePath(mediaId, fileName, mimeType)}`;
}

export function ensureMediaFileName(fileName: string, mimeType: string): string {
  const safe = safeDownloadName(fileName || fallbackNameFromMime(mimeType));
  const ext = mediaFileExt(safe, mimeType);
  if (!ext) return safe;
  if (fileExt(safe) === ext) return safe;
  return `${safe}${ext}`;
}

export function fallbackNameFromMime(mimeType: string): string {
  const normalized = normalizeMediaMime(mimeType);
  if (normalized === "video/quicktime") return "video.mov";
  if (normalized === "video/mp4") return "video.mp4";
  if (normalized === "video/x-m4v" || normalized === "video/m4v") return "video.m4v";
  if (normalized === "video/webm") return "video.webm";
  if (normalized === "application/pdf") return "document.pdf";
  if (normalized.startsWith("image/")) return "photo.jpg";
  return "upload";
}

export function fallbackFileName(file: { name?: string; type?: string }): string {
  const name = (file.name || "").trim();
  if (name) return name;
  return fallbackNameFromMime(file.type || "");
}

export function formatByteSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatMaxMb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

export function formatMediaDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "";
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  }
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function sponsorAttachmentError(
  fileName: string,
  mimeType: string,
  size: number
): string | null {
  if (looksLikeVideo(fileName, mimeType)) return VIDEOS_GO_ON_MEDIA;
  if (isUnknownFileSize(size)) return "Empty file";
  if (size > MAX_ATTACHMENT_BYTES) {
    const photo = resolveAttachmentMime(fileName, mimeType);
    const heif =
      /heic|heif/.test(normalizeMediaMime(mimeType)) ||
      fileExt(fileName) === ".heic" ||
      fileExt(fileName) === ".heif";
    if (!photo || heif) return VIDEOS_GO_ON_MEDIA;
    return `File is too large (max ${formatMaxMb(MAX_ATTACHMENT_BYTES)})`;
  }
  return null;
}

export function assertAllowedAttachment(fileName: string, mimeType: string, size: number) {
  const blocked = sponsorAttachmentError(fileName, mimeType, size);
  if (blocked) throw new Error(blocked);
  const resolved = resolveAttachmentMime(fileName, mimeType);
  if (!resolved) throw new Error("Only photos and PDFs are allowed");
  return resolved;
}

export function assertAllowedMedia(
  fileName: string,
  mimeType: string,
  size: number,
  maxBytes: number
) {
  const resolved = resolveMediaMime(fileName, mimeType);
  if (!resolved) throw new Error("Only photos, videos, and PDFs are allowed");
  // iOS Photos/Files can report 0 or omit size — never treat that as “too large”.
  if (isUnknownFileSize(size)) return resolved;
  if (size > maxBytes) {
    throw new Error(`File is too large (max ${formatMaxMb(maxBytes)})`);
  }
  return resolved;
}

export function videoTooLargeForHost(input: {
  isVideo: boolean;
  size: number;
  clientUpload: boolean;
  vercel: boolean;
  maxBytes: number;
}): boolean {
  if (!input.isVideo) return false;
  if (isUnknownFileSize(input.size)) return false;
  if (input.size <= SMALL_VIDEO_OK_BYTES) return false;
  const cap = input.clientUpload
    ? Math.max(input.maxBytes || 0, MAX_MEDIA_BLOB_BYTES)
    : Math.max(input.maxBytes || 0, MAX_MEDIA_SERVER_BYTES);
  return input.size > cap;
}
