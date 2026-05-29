import { catalogRepository } from "@/backend/repositories/catalog-repository";
import { ApiError, handleRouteError, ok } from "@/lib/http";
import { requireActor, requireOutletAccess } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const { searchParams } = new URL(request.url);
    const outletId = searchParams.get("outletId");
    const since = searchParams.get("since");
    if (!outletId) {
      throw new ApiError("BAD_REQUEST", "outletId is required", 400);
    }
    await requireOutletAccess(actor, outletId);

    const sinceDate = since ? new Date(since) : new Date(0);
    const { products, skus, units, balances } = await catalogRepository.pullChanges(
      actor.organizationId,
      outletId,
      sinceDate,
    );

    return ok({
      serverTime: new Date().toISOString(),
      outletId,
      products,
      skus,
      units,
      balances,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
