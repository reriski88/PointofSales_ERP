import { outletRepository } from "@/backend/repositories/outlet-repository";
import { writeAudit } from "@/lib/audit";
import { ApiError, created, handleRouteError, ok, parseJson } from "@/lib/http";
import { actorHasPermission, requireActor, requirePermission } from "@/lib/rbac";
import { createOutletSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const canViewOutlets = await actorHasPermission(actor, "outlets", "view");
    const canViewCashier = await actorHasPermission(actor, "cashier", "view");
    if (!canViewOutlets && !canViewCashier) {
      throw new ApiError("FORBIDDEN", "Role permission is not allowed for this operation", 403);
    }
    const rows =
      actor.role === "owner"
        ? await outletRepository.findByOrganization(actor.organizationId)
        : await outletRepository.findActiveByUser(actor.id, actor.organizationId);
    return ok(rows);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "outlets", "create");
    const body = await parseJson(request, createOutletSchema);
    const [row] = await outletRepository.create({
        organizationId: actor.organizationId,
        name: body.name,
        code: body.code,
        address: body.address,
        logoUrl: body.logoUrl,
      });
    await writeAudit({
      actor,
      outletId: row.id,
      action: "outlet.create",
      entityType: "outlet",
      entityId: row.id,
      after: row,
      request,
    });
    return created(row);
  } catch (error) {
    return handleRouteError(error);
  }
}
