import { approveWasteAdjustment } from "@/services/waste";
import { handleRouteError, ok, parseJson } from "@/lib/http";
import { requireActor, requireMinimumRole } from "@/lib/rbac";
import { approveWasteSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor(request);
    requireMinimumRole(actor, "admin_outlet");
    const body = await parseJson(request, approveWasteSchema);
    const { id } = await params;
    const result = await approveWasteAdjustment(actor, id, body.approved, body.note, request);
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
