import { catalogRepository } from "@/backend/repositories/catalog-repository";
import { ApiError, handleRouteError, ok, parseListQuery } from "@/lib/http";
import { requireActor, requireOutletAccess } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const { searchParams } = new URL(request.url);
    const outletId = searchParams.get("outletId");
    if (!outletId) {
      throw new ApiError("BAD_REQUEST", "outletId is required", 400);
    }
    await requireOutletAccess(actor, outletId);

    const listQuery = parseListQuery(searchParams, 1000);
    const rows = await catalogRepository.findOutletCatalog(actor.organizationId, outletId, listQuery);

    return ok({
      outletId,
      serverTime: new Date().toISOString(),
      items: rows,
      page: listQuery.limit ? listQuery.page ?? Math.floor((listQuery.offset ?? 0) / listQuery.limit) + 1 : undefined,
      limit: listQuery.limit,
      offset: listQuery.offset,
      hasMore: listQuery.limit ? rows.length === listQuery.limit : undefined,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
