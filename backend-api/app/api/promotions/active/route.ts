import { promotionRepository } from "@/backend/repositories/promotion-repository";
import { handleRouteError, ok } from "@/lib/http";
import { requireActor, requireAnyPermission } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    await requireAnyPermission(actor, [
      { menu: "cashier", action: "view" },
      { menu: "promotions", action: "view" },
    ]);
    const rows = await promotionRepository.findActiveMany(actor.organizationId);
    return ok({ items: rows });
  } catch (error) {
    return handleRouteError(error);
  }
}
