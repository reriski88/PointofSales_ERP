import { promotionRepository } from "@/backend/repositories/promotion-repository";
import { writeAudit } from "@/lib/audit";
import { created, handleRouteError, ok, parseJson } from "@/lib/http";
import { fixed } from "@/lib/number";
import { requireActor, requirePermission } from "@/lib/rbac";
import { publishRealtimeEvent } from "@/lib/realtime";
import { promotionSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "promotions", "view");
    const rows = await promotionRepository.findMany(actor.organizationId);
    return ok(rows);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "promotions", "create");
    const body = await parseJson(request, promotionSchema);
    const [row] = await promotionRepository.create({
      organizationId: actor.organizationId,
      name: body.name,
      code: normalizeCode(body.code),
      type: body.type,
      discountType: body.discountType,
      discountValue: fixed(body.discountValue),
      scope: body.scope,
      targetSkuId: body.targetSkuId,
      targetCategory: body.targetCategory || null,
      outletIds: body.outletIds,
      minSubtotal: fixed(body.minSubtotal),
      buyQty: fixed(body.buyQty, 3),
      getQty: fixed(body.getQty, 3),
      maxRedemptions: body.maxRedemptions ?? null,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
      isActive: body.isActive,
    });

    await writeAudit({
      actor,
      action: "promotion.create",
      entityType: "promotion",
      entityId: row.id,
      after: row,
      request,
    });

    publishRealtimeEvent({
      organizationId: actor.organizationId,
      topics: ["promotions", "settings"],
      type: "promotion.created",
      payload: { promotionId: row.id },
    });

    return created(row);
  } catch (error) {
    return handleRouteError(error);
  }
}

function normalizeCode(code?: string | null) {
  const value = code?.trim().toUpperCase();
  return value || null;
}
