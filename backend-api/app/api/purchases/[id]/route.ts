import { getPurchaseOrderDetail } from "@/services/purchases";
import { handleRouteError, ok } from "@/lib/http";
import { requireActor, requirePermission } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor(_);
    await requirePermission(actor, "purchases", "view");
    const { id } = await params;
    const result = await getPurchaseOrderDetail(actor, id);
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
