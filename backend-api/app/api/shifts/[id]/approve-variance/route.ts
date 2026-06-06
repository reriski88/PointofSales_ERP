import { shiftRepository } from "@/backend/repositories/shift-repository";
import { writeAudit } from "@/lib/audit";
import { ApiError, handleRouteError, ok } from "@/lib/http";
import { requireActor, requireOutletAccess, requirePermission } from "@/lib/rbac";
import { publishRealtimeEvent } from "@/lib/realtime";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "cashier", "edit");
    if (actor.role !== "owner" && actor.role !== "admin_outlet") {
      throw new ApiError("FORBIDDEN", "Hanya owner/admin outlet yang bisa approve selisih kas shift", 403);
    }
    const { id } = await params;
    const [existing] = await shiftRepository.findById(id, actor.organizationId);
    if (!existing) {
      throw new ApiError("NOT_FOUND", "Shift tidak ditemukan", 404);
    }
    await requireOutletAccess(actor, existing.outletId);
    if (existing.closeApprovalStatus !== "variance_pending") {
      throw new ApiError("CONFLICT", "Shift tidak menunggu approval selisih kas", 409);
    }

    const [row] = await shiftRepository.approveVariance(id, actor.organizationId, actor.id);
    if (!row) {
      throw new ApiError("CONFLICT", "Approval selisih kas gagal diproses", 409);
    }

    await writeAudit({
      actor,
      outletId: row.outletId,
      action: "shift.variance.approve",
      entityType: "shift",
      entityId: row.id,
      before: existing,
      after: row,
      request,
    });

    publishRealtimeEvent({
      organizationId: actor.organizationId,
      outletId: row.outletId,
      topics: ["shift", "dashboard"],
      type: "shift.variance_approved",
      payload: { shiftId: row.id, cashVariance: row.cashVariance },
    });

    return ok(row);
  } catch (error) {
    return handleRouteError(error);
  }
}
