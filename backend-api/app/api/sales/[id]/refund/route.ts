import { salesRepository } from "@/backend/repositories/sales-repository";
import { refundSale } from "@/services/sales";
import { ApiError, handleRouteError, ok, parseJson } from "@/lib/http";
import { requireActor, requireOutletAccess, requireRole } from "@/lib/rbac";
import { publishRealtimeEvent } from "@/lib/realtime";
import { refundSaleSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor(request);
    requireRole(actor, ["owner", "admin_outlet"]);
    const body = await parseJson(request, refundSaleSchema);
    const { id } = await params;
    const [row] = await salesRepository.findSaleById(id, actor.organizationId);

    if (!row) {
      throw new ApiError("NOT_FOUND", "Transaksi tidak ditemukan", 404);
    }

    await requireOutletAccess(actor, row.outletId);
    const result = await refundSale(actor, id, body, request);
    publishRealtimeEvent({
      organizationId: actor.organizationId,
      outletId: row.outletId,
      topics: ["sales", "inventory", "dashboard", "shift", "customers"],
      type: "sale.refunded",
      payload: { saleId: id },
    });
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
