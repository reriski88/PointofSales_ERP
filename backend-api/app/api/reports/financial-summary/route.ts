import { reportRepository } from "@/backend/repositories/report-repository";
import { ApiError, handleRouteError, ok } from "@/lib/http";
import { requireActor, requireOutletAccess, requirePermission } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "financialReports", "view");
    const { searchParams } = new URL(request.url);
    const outletId = searchParams.get("outletId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (outletId) {
      await requireOutletAccess(actor, outletId);
    } else if (actor.role !== "owner" && actor.role !== "auditor") {
      throw new ApiError("BAD_REQUEST", "outletId is required for this role", 400);
    }

    const [[sales], [inventory], [waste], payments, [valuation]] = await Promise.all([
      reportRepository.salesSummary(actor.organizationId, outletId, from, to),
      reportRepository.inventorySummary(actor.organizationId, outletId),
      reportRepository.wasteSummary(actor.organizationId, outletId, from, to),
      reportRepository.paymentSummary(actor.organizationId, outletId, from, to),
      reportRepository.inventoryValuation(actor.organizationId, outletId),
    ]);

    return ok({
      sales,
      inventory,
      waste,
      payments,
      valuation,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
