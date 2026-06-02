import { financeRepository } from "@/backend/repositories/finance-repository";
import { handleRouteError, ok } from "@/lib/http";
import { requireActor, requirePermission } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "reports", "view");
    const rows = await financeRepository.listJournalEntries(actor.organizationId);
    return ok(rows);
  } catch (error) {
    return handleRouteError(error);
  }
}
