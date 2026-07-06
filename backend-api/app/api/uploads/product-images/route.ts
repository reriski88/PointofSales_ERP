import { ApiError, handleRouteError, ok } from "@/lib/http";
import { assertImageKeyAccess, readImageFile, saveImageFile } from "@/lib/local-image-storage";
import { requireActor, requireAnyPermission } from "@/lib/rbac";

export const runtime = "nodejs";

const maxImageBytes = 5 * 1024 * 1024;

async function requireProductUploadAccess(request: Request) {
  const actor = await requireActor(request, { skipSubscriptionCheck: true });
  await requireAnyPermission(actor, [
    { menu: "products", action: "create" },
    { menu: "products", action: "edit" },
  ]);
  return actor;
}

export async function POST(request: Request) {
  try {
    const actor = await requireProductUploadAccess(request);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new ApiError("BAD_REQUEST", "File foto produk wajib dikirim.", 400);
    }

    const saved = await saveImageFile("products", actor.organizationId, file, maxImageBytes);

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
    const key = assertImageKeyAccess(new URL(request.url).searchParams.get("key") ?? "", actor.organizationId, ["products"]);
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
