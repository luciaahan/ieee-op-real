import { randomUUID } from "crypto";
import { mkdir, writeFile, readFile, access } from "fs/promises";
import path from "path";

const UPLOAD_ROOT = path.join(process.cwd(), "data", "uploads", "deliverables");

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const MAX_BYTES = 10 * 1024 * 1024;

export function isAllowedPosterMime(mime: string): boolean {
  return ALLOWED_MIME.has(mime);
}

function sanitizeFilename(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.slice(0, 120) || "poster";
}

export async function saveDeliverableAsset(
  deliverableId: string,
  file: File,
): Promise<{ storagePath: string; fileName: string }> {
  if (!isAllowedPosterMime(file.type)) {
    throw new Error("Only PDF and image files (JPEG, PNG, GIF, WebP) are allowed.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("File must be 10 MB or smaller.");
  }

  const fileName = sanitizeFilename(file.name);
  const storagePath = `${deliverableId}/${randomUUID()}-${fileName}`;
  const absolutePath = path.join(UPLOAD_ROOT, storagePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, buffer);

  return { storagePath, fileName };
}

export function deliverableAssetAbsolutePath(storagePath: string): string {
  const normalized = path.normalize(storagePath);
  if (normalized.startsWith("..") || path.isAbsolute(normalized)) {
    throw new Error("Invalid asset path");
  }
  return path.join(UPLOAD_ROOT, normalized);
}

export async function readDeliverableAsset(storagePath: string): Promise<Buffer> {
  const absolutePath = deliverableAssetAbsolutePath(storagePath);
  await access(absolutePath);
  return readFile(absolutePath);
}

export function deliverableAssetDownloadName(storagePath: string): string {
  const base = path.basename(storagePath);
  const dash = base.indexOf("-");
  return dash >= 0 ? base.slice(dash + 1) : base;
}

export function deliverableAssetContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case ".pdf":
      return "application/pdf";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}
