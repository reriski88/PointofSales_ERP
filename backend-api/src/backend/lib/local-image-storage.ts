import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { ApiError } from "@/lib/http";

type ImageScope = "outlets" | "products" | "profiles";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function validateImageFile(file: File, maxImageBytes: number) {
  if (!allowedTypes.has(file.type)) {
    throw new ApiError("BAD_REQUEST", "File harus berupa gambar JPG, PNG, WebP, atau GIF.", 400);
  }
  if (file.size > maxImageBytes) {
    throw new ApiError("BAD_REQUEST", `Ukuran gambar maksimal ${Math.floor(maxImageBytes / 1024 / 1024)} MB.`, 400);
  }
}

export function extensionForMime(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "jpg";
}

export function makeImageObjectName(scope: ImageScope, organizationId: string, type: string) {
  return `${scope}/${organizationId}/${randomUUID()}.${extensionForMime(type)}`;
}

export function getUploadRoot() {
  return resolve(process.env.UPLOAD_DIR?.trim() || join(process.cwd(), "uploads"));
}

export function getUploadPublicBaseUrl() {
  const value = process.env.UPLOAD_PUBLIC_BASE_URL?.trim() || "/uploads";
  return value.replace(/\/$/, "");
}

export function publicUrlForImageKey(key: string) {
  return `${getUploadPublicBaseUrl()}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export function cleanImageKey(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("../") || normalized.includes("/..") || normalized === "..") return null;
  if (!/^(outlets|products|profiles)\/[^/]+\/[A-Za-z0-9-]+\.(jpg|png|webp|gif)$/.test(normalized)) return null;
  return normalized;
}

export function imageKeyFromUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = value.startsWith("/") ? new URL(value, "http://internal.local") : new URL(value);
    if (url.pathname === "/api/uploads/images" || url.pathname === "/api/uploads/product-images") {
      return cleanImageKey(url.searchParams.get("key"));
    }
    const publicBase = getUploadPublicBaseUrl();
    const basePath = publicBase.startsWith("http") ? new URL(publicBase).pathname : publicBase;
    if (url.pathname === basePath || !url.pathname.startsWith(`${basePath}/`)) return null;
    return cleanImageKey(decodeURIComponent(url.pathname.slice(basePath.length + 1)));
  } catch {
    return null;
  }
}

export function assertImageKeyAccess(key: string, organizationId: string, scopes: ImageScope[]) {
  const cleanKey = cleanImageKey(key);
  if (!cleanKey) throw new ApiError("BAD_REQUEST", "Key gambar tidak valid.", 400);
  if (!scopes.some((scope) => cleanKey.startsWith(`${scope}/${organizationId}/`))) {
    throw new ApiError("FORBIDDEN", "Gambar tidak bisa diakses.", 403);
  }
  return cleanKey;
}

export function localImagePath(key: string) {
  const cleanKey = cleanImageKey(key);
  if (!cleanKey) throw new ApiError("BAD_REQUEST", "Key gambar tidak valid.", 400);
  const root = getUploadRoot();
  const target = resolve(root, cleanKey);
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    throw new ApiError("BAD_REQUEST", "Path gambar tidak valid.", 400);
  }
  return target;
}

export async function saveImageFile(scope: ImageScope, organizationId: string, file: File, maxImageBytes: number) {
  validateImageFile(file, maxImageBytes);
  const key = makeImageObjectName(scope, organizationId, file.type);
  const target = localImagePath(key);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await file.arrayBuffer()));
  return { key, url: publicUrlForImageKey(key) };
}

export async function readImageFile(key: string) {
  const target = localImagePath(key);
  const [info, data] = await Promise.all([stat(target), readFile(target)]);
  return { data, size: info.size, contentType: contentTypeForKey(key) };
}

export async function deleteImageObjectByUrl(value: string | null | undefined) {
  const key = imageKeyFromUrl(value);
  if (!key) return;
  await rm(localImagePath(key), { force: true });
}

export async function deleteReplacedImageObject(previous: string | null | undefined, next: string | null | undefined) {
  const previousKey = imageKeyFromUrl(previous);
  if (!previousKey || previousKey === imageKeyFromUrl(next)) return;
  await deleteImageObjectByUrl(previous);
}

function contentTypeForKey(key: string) {
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".webp")) return "image/webp";
  if (key.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}
