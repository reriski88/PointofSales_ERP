import { syncRepository } from "@/backend/repositories/sync-repository";
import { createSale } from "@/services/sales";
import { handleRouteError, ok, parseJson } from "@/lib/http";
import { requireActor, requireOutletAccess, requireRole } from "@/lib/rbac";
import { syncPushSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    requireRole(actor, ["owner", "admin_outlet", "cashier"]);
    const body = await parseJson(request, syncPushSchema);
    await requireOutletAccess(actor, body.outletId);

    const results = [];
    for (const transaction of body.transactions) {
      await syncRepository.receive({
          organizationId: actor.organizationId,
          outletId: body.outletId,
          idempotencyKey: transaction.idempotencyKey,
          payload: transaction,
          status: "received",
        });

      try {
        const result = await createSale(actor, transaction, request);
        await syncRepository.updateByIdempotencyKey(actor.organizationId, transaction.idempotencyKey, {
            status: result.sale.status === "sync_review" ? "conflict" : "processed",
            processedSaleId: result.sale.id,
            processedAt: new Date(),
          });
        results.push({
          idempotencyKey: transaction.idempotencyKey,
          status: result.sale.status === "sync_review" ? "conflict" : "processed",
          saleId: result.sale.id,
          idempotent: result.idempotent,
        });
      } catch (error) {
        await syncRepository.updateByIdempotencyKey(actor.organizationId, transaction.idempotencyKey, {
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
            processedAt: new Date(),
          });
        results.push({
          idempotencyKey: transaction.idempotencyKey,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return ok({ results });
  } catch (error) {
    return handleRouteError(error);
  }
}
