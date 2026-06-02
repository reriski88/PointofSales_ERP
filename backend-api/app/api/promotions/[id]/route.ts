import { promotionRepository } from "@/backend/repositories/promotion-repository";
import { writeAudit } from "@/lib/audit";
import { ApiError, handleRouteError, ok, parseJson } from "@/lib/http";
import { fixed } from "@/lib/number";
import { requireActor, requirePermission } from "@/lib/rbac";
import { publishRealtimeEvent } from "@/lib/realtime";
import { updatePromotionSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "promotions", "edit");
    const { id } = await params;
    const body = await parseJson(request, updatePromotionSchema);

    const result = await promotionRepository.transaction(async (tx) => {
      const [before] = await promotionRepository.findById(tx, id, actor.organizationId);
      if (!before) {
        throw new ApiError("NOT_FOUND", "Promo tidak ditemukan", 404);
      }
      const [row] = await promotionRepository.update(id, actor.organizationId, {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.code !== undefined ? { code: normalizeCode(body.code) } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.discountType !== undefined ? { discountType: body.discountType } : {}),
        ...(body.discountValue !== undefined ? { discountValue: fixed(body.discountValue) } : {}),
        ...(body.scope !== undefined ? { scope: body.scope } : {}),
        ...(body.targetSkuId !== undefined ? { targetSkuId: body.targetSkuId } : {}),
        ...(body.targetCategory !== undefined ? { targetCategory: body.targetCategory || null } : {}),
        ...(body.outletIds !== undefined ? { outletIds: body.outletIds } : {}),
        ...(body.minSubtotal !== undefined ? { minSubtotal: fixed(body.minSubtotal) } : {}),
        ...(body.buyQty !== undefined ? { buyQty: fixed(body.buyQty, 3) } : {}),
        ...(body.getQty !== undefined ? { getQty: fixed(body.getQty, 3) } : {}),
        ...(body.maxRedemptions !== undefined ? { maxRedemptions: body.maxRedemptions ?? null } : {}),
        ...(body.startsAt !== undefined ? { startsAt: body.startsAt ? new Date(body.startsAt) : null } : {}),
        ...(body.endsAt !== undefined ? { endsAt: body.endsAt ? new Date(body.endsAt) : null } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        updatedAt: new Date(),
      });
      return { before, row };
    });

    await writeAudit({
      actor,
      action: "promotion.update",
      entityType: "promotion",
      entityId: result.row.id,
      before: result.before,
      after: result.row,
      request,
    });

    publishRealtimeEvent({
      organizationId: actor.organizationId,
      topics: ["promotions", "settings"],
      type: "promotion.updated",
      payload: { promotionId: result.row.id },
    });

    return ok(result.row);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "promotions", "delete");
    const { id } = await params;

    const result = await promotionRepository.transaction(async (tx) => {
      const [before] = await promotionRepository.findById(tx, id, actor.organizationId);
      if (!before) {
        throw new ApiError("NOT_FOUND", "Promo tidak ditemukan", 404);
      }
      const [deleted] = await promotionRepository.delete(id, actor.organizationId);
      return { before, deleted };
    });

    await writeAudit({
      actor,
      action: "promotion.delete",
      entityType: "promotion",
      entityId: result.before.id,
      before: result.before,
      after: result.deleted,
      request,
    });

    publishRealtimeEvent({
      organizationId: actor.organizationId,
      topics: ["promotions", "settings"],
      type: "promotion.deleted",
      payload: { promotionId: result.before.id },
    });

    return ok(result.deleted);
  } catch (error) {
    return handleRouteError(error);
  }
}

function normalizeCode(code?: string | null) {
  const value = code?.trim().toUpperCase();
  return value || null;
}
