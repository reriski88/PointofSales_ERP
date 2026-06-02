import { shiftRepository } from "@/backend/repositories/shift-repository";
import { ApiError, handleRouteError, ok } from "@/lib/http";
import { decimal } from "@/lib/number";
import { requireActor, requireOutletAccess } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor(_request);
    const { id } = await context.params;
    const [targetShift] = await shiftRepository.findById(id, actor.organizationId);

    if (!targetShift) {
      throw new ApiError("NOT_FOUND", "Shift tidak ditemukan", 404);
    }

    await requireOutletAccess(actor, targetShift.outletId);

    if (actor.role === "cashier" && targetShift.cashierUserId !== actor.id) {
      throw new ApiError("FORBIDDEN", "Kasir hanya bisa melihat shift miliknya", 403);
    }

    const [cashMovements, paymentSummary] = await Promise.all([
      shiftRepository.findCashMovements(id, actor.organizationId),
      shiftRepository.paymentSummary(id, actor.organizationId),
    ]);
    const actualCash = targetShift.actualCash === null ? null : decimal(targetShift.actualCash);
    const expectedCash = decimal(targetShift.expectedCash);

    return ok({
      shift: targetShift,
      cashMovements,
      paymentSummary,
      variance: actualCash === null ? null : actualCash - expectedCash,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
