import { ApiError, handleRouteError, ok } from "@/lib/http";
import {
  assertImageKeyAccess,
  readImageFile,
  saveImageFile,
} from "@/lib/local-image-storage";
import { requireActor, requireAnyPermission } from "@/lib/rbac";

export const runtime = "nodejs";

const maxImageBytes = 5 * 1024 * 1024;
const scopes = new Set(["outlets", "products", "profiles"]);

async function requireUploadAccess(request: Request, scope: string) {
  const actor = await requireActor(request);
  if (scope === "outlets") {
    await requireAnyPermission(actor, [
      { menu: "outlets", action: "create" },
      { menu: "outlets", action: "edit" },
    ]);
    return actor;
  }
  if (scope === "products") {
    await requireAnyPermission(actor, [
      { menu: "products", action: "create" },
      { menu: "products", action: "edit" },
    ]);
    return actor;
  }
  if (scope === "profiles") {
    await requireAnyPermission(actor, [
      { menu: "profile", action: "edit" },
      { menu: "users", action: "create" },
      { menu: "users", action: "edit" },
    ]);
    return actor;
  }
  throw new ApiError("BAD_REQUEST", "Scope upload tidak valid.", 400);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const scope = String(formData.get("scope") ?? "");
    if (!scopes.has(scope)) {
      throw new ApiError("BAD_REQUEST", "Scope upload tidak valid.", 400);
    }
    const actor = await requireUploadAccess(request, scope);
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new ApiError("BAD_REQUEST", "File gambar wajib dikirim.", 400);
    }
    const saved = await saveImageFile(scope as "outlets" | "products" | "profiles", actor.organizationId, file, maxImageBytes);

    return ok({
      key: saved.key,
      url: saved.url,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const key = assertImageKeyAccess(new URL(request.url).searchParams.get("key") ?? "", actor.organizationId, ["outlets", "products", "profiles"]);
    const image = await readImageFile(key);
    return new Response(image.data, {
      headers: {
        "Content-Type": image.contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
