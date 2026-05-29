import { outletRepository } from "@/backend/repositories/outlet-repository";
import { writeAudit } from "@/lib/audit";
import { ApiError, handleRouteError, ok, parseJson } from "@/lib/http";
import { requireActor, requirePermission } from "@/lib/rbac";
import { updateOutletSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "outlets", "edit");
    const { id } = await params;
    const body = await parseJson(request, updateOutletSchema);

    const [existing] = await outletRepository.findById(id, actor.organizationId);

    if (!existing) {
      throw new ApiError("NOT_FOUND", "Outlet not found", 404);
    }

    const [updated] = await outletRepository.update(id, {
        name: body.name ?? existing.name,
        address: body.address === undefined ? existing.address : body.address,
        logoUrl: body.logoUrl === undefined ? existing.logoUrl : body.logoUrl,
        isActive: body.isActive ?? existing.isActive,
        updatedAt: new Date(),
      });

    await writeAudit({
      actor,
      outletId: id,
      action: "outlet.update",
      entityType: "outlet",
      entityId: id,
      before: existing,
      after: updated,
      request,
    });

    return ok(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}
