import { unitRepository } from "@/backend/repositories/unit-repository";
import { writeAudit } from "@/lib/audit";
import { fixed } from "@/lib/number";
import { ApiError, handleRouteError, ok, parseJson } from "@/lib/http";
import { requireActor, requirePermission } from "@/lib/rbac";
import { updateUnitSchema, uuidSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "products", "edit");
    const { id } = await params;
    const unitId = uuidSchema.parse(id);
    const body = await parseJson(request, updateUnitSchema);
    const [before] = await unitRepository.findById(unitId, actor.organizationId);
    if (!before) throw new ApiError("NOT_FOUND", "Satuan tidak ditemukan", 404);

    const [row] = await unitRepository.update(unitId, actor.organizationId, {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.code !== undefined ? { code: body.code.trim().toUpperCase() } : {}),
      ...(body.kind !== undefined ? { kind: body.kind } : {}),
      ...(body.toBaseFactor !== undefined ? { toBaseFactor: fixed(body.toBaseFactor, 6) } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      updatedAt: new Date(),
    });
    await writeAudit({
      actor,
      action: "unit.update",
      entityType: "unit",
      entityId: unitId,
      before,
      after: row,
      request,
    });
    return ok(row);
  } catch (error) {
    return handleRouteError(error);
  }
}
