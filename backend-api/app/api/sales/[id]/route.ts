import { salesRepository } from "@/backend/repositories/sales-repository";
import { ApiError, handleRouteError, ok } from "@/lib/http";
import { requireActor, requireOutletAccess } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor(request);
    const { id } = await params;
    const [row] = await salesRepository.findSaleById(id, actor.organizationId);

    if (!row) {
      throw new ApiError("NOT_FOUND", "Sale not found", 404);
    }

    await requireOutletAccess(actor, row.outletId);

    const items = await salesRepository.findSaleItems(row.id);
    const payments = await salesRepository.findSalePayments(row.id);

    return ok({ ...row, items, payments });
  } catch (error) {
    return handleRouteError(error);
  }
}
