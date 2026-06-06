import { syncRepository } from "@/backend/repositories/sync-repository";
import { createSale } from "@/services/sales";
import { handleRouteError, ok, parseJson } from "@/lib/http";
import { requireActor, requireOutletAccess, requirePermission } from "@/lib/rbac";
import { publishRealtimeEvent } from "@/lib/realtime";
import { syncPushSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "cashier", "create");
    const body = await parseJson(request, syncPushSchema);
    await requireOutletAccess(actor, body.outletId);

    const results = [];
    for (const transaction of body.transactions) {
      if (transaction.outletId !== body.outletId) {
        results.push({
          idempotencyKey: transaction.idempotencyKey,
          status: "failed",
          error: "Outlet transaksi tidak sesuai dengan outlet sync.",
        });
        continue;
      }
      await syncRepository.receive({
          organizationId: actor.organizationId,
          outletId: body.outletId,
          idempotencyKey: transaction.idempotencyKey,
          payload: transaction,
          status: "received",
        });

      try {
        const result = await createSale(actor, transaction, request, { allowStockConflict: true });
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

    publishRealtimeEvent({
      organizationId: actor.organizationId,
      outletId: body.outletId,
      topics: ["sync", "sales", "inventory", "dashboard", "shift", "customers"],
      type: "sync.push.processed",
      payload: {
        total: results.length,
        processed: results.filter((item) => item.status === "processed").length,
        conflict: results.filter((item) => item.status === "conflict").length,
        failed: results.filter((item) => item.status === "failed").length,
      },
    });

    return ok({ results });
  } catch (error) {
    return handleRouteError(error);
  }
}
