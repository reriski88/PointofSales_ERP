import { inventoryRepository } from '@/backend/repositories/inventory-repository';
import { writeAudit } from '@/lib/audit';
import { ApiError, created, handleRouteError, parseJson } from '@/lib/http';
import { requireActor, requireOutletAccess, requirePermission } from '@/lib/rbac';
import { publishRealtimeEvent } from '@/lib/realtime';
import { reconcileBatchGapSchema } from '@/lib/validation';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, 'inventory', 'edit');
    const body = await parseJson(request, reconcileBatchGapSchema);
    await requireOutletAccess(actor, body.outletId);

    const result = await inventoryRepository.reconcileBatchGap({
      organizationId: actor.organizationId,
      outletId: body.outletId,
      skuId: body.skuId,
      actorUserId: actor.id,
    });
    if (!result) {
      throw new ApiError('NOT_FOUND', 'SKU atau outlet tidak ditemukan', 404);
    }
    if ('error' in result) {
      throw new ApiError('CONFLICT', 'Tidak ada selisih batch untuk direkonsiliasi', 409);
    }

    await writeAudit({
      actor,
      outletId: body.outletId,
      action: 'inventory.batch_gap.reconcile',
      entityType: 'inventory_batch',
      entityId: result.batch.id,
      after: { ...body, batchId: result.batch.id, gapBaseQty: result.gapBaseQty },
      request,
    });

    publishRealtimeEvent({
      organizationId: actor.organizationId,
      outletId: body.outletId,
      topics: ['inventory', 'dashboard'],
      type: 'inventory.batch_gap.reconciled',
      payload: { batchId: result.batch.id, skuId: body.skuId, gapBaseQty: result.gapBaseQty },
    });

    return created(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
