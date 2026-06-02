import { purchaseRepository } from "@/backend/repositories/purchase-repository";
import { writeAudit } from "@/lib/audit";
import { ApiError, handleRouteError, ok, parseJson } from "@/lib/http";
import { requireActor, requirePermission } from "@/lib/rbac";
import { updateSupplierSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "suppliers", "edit");
    const { id } = await params;
    const body = await parseJson(request, updateSupplierSchema);
    const [row] = await purchaseRepository.updateSupplier(id, actor.organizationId, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.code !== undefined ? { code: body.code } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.address !== undefined ? { address: body.address } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      updatedAt: new Date(),
    });

    if (!row) {
      throw new ApiError("NOT_FOUND", "Supplier tidak ditemukan", 404);
    }

    await writeAudit({
      actor,
      action: "supplier.update",
      entityType: "supplier",
      entityId: row.id,
      after: row,
      request,
    });

    return ok(row);
  } catch (error) {
    return handleRouteError(error);
  }
}
