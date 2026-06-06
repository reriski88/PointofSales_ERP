import { ApiError, handleRouteError } from "@/lib/http";
import { assertImageKeyAccess, readImageFile } from "@/lib/local-image-storage";
import { requireActor } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ path: string[] }>;
};

export async function GET(request: Request, { params }: Params) {
  try {
    const actor = await requireActor(request);
    const { path } = await params;
    if (!path?.length) throw new ApiError("BAD_REQUEST", "Path gambar tidak valid.", 400);

    const key = assertImageKeyAccess(path.join("/"), actor.organizationId, ["outlets", "products", "profiles"]);
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
