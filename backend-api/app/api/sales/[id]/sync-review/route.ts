import { salesRepository } from "@/backend/repositories/sales-repository";
import { resolveSyncReviewSale } from "@/services/sales";
import { ApiError, handleRouteError, ok, parseJson } from "@/lib/http";
import { requireActor, requireOutletAccess, requirePermission } from "@/lib/rbac";
import { publishRealtimeEvent } from "@/lib/realtime";
import { resolveSyncReviewSaleSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "cashier", "edit");
    const body = await parseJson(request, resolveSyncReviewSaleSchema);
    const { id } = await params;
    const [row] = await salesRepository.findSaleById(id, actor.organizationId);

    if (!row) {
      throw new ApiError("NOT_FOUND", "Transaksi tidak ditemukan", 404);
    }

    await requireOutletAccess(actor, row.outletId);
    const result = await resolveSyncReviewSale(actor, id, body, request);
    publishRealtimeEvent({
      organizationId: actor.organizationId,
      outletId: row.outletId,
      topics: ["sync", "sales", "inventory", "dashboard", "shift", "customers"],
      type: body.action === "post" ? "sale.sync_review.posted" : "sale.sync_review.rejected",
      payload: { saleId: id, action: body.action },
    });
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
