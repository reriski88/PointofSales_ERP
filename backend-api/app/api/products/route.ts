import { productRepository } from "@/backend/repositories/product-repository";
import { writeAudit } from "@/lib/audit";
import { fixed } from "@/lib/number";
import { ApiError, created, handleRouteError, ok, parseJson, parseListQuery } from "@/lib/http";
import { requireActor, requireOutletAccess, requirePermission } from "@/lib/rbac";
import { enforceSkuLimit } from "@/lib/subscription-limits";
import { createProductSchema } from "@/lib/validation";

export const runtime = "nodejs";
const allOutletsValue = "__all_outlets__";

function requireSpecificOutletId(outletId: string | null) {
  if (!outletId || outletId === allOutletsValue) {
    throw new ApiError("BAD_REQUEST", "Menu Produk membutuhkan outlet spesifik. Pilih satu outlet terlebih dahulu, bukan Semua Outlet.", 400);
  }
  return outletId;
}

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "products", "view");
    const searchParams = new URL(request.url).searchParams;
    const outletId = requireSpecificOutletId(searchParams.get("outletId"));
    await requireOutletAccess(actor, outletId);
    const listQuery = parseListQuery(searchParams);
    const [rows, outletSkus] = await Promise.all([
      productRepository.findManyWithSkus(actor.organizationId, outletId, listQuery),
      productRepository.findSkuIdsByOutlet(outletId),
    ]);
    const outletSkuIds = new Set(outletSkus.map((row) => row.skuId));
    const visibleRows = rows
      .map((row) => ({
        ...row,
        skus: row.skus.filter((item) => outletSkuIds.has(item.id) || item.trackInventory === false),
      }))
      .filter((row) => row.skus.length > 0);
    if (listQuery.limit) {
      return ok({
        items: visibleRows,
        page: listQuery.page ?? Math.floor((listQuery.offset ?? 0) / listQuery.limit) + 1,
        limit: listQuery.limit,
        offset: listQuery.offset ?? 0,
        hasMore: rows.length === listQuery.limit,
      });
    }

    return ok(visibleRows);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "products", "create");
    await enforceSkuLimit(actor);
    const outletId = requireSpecificOutletId(new URL(request.url).searchParams.get("outletId"));
    await requireOutletAccess(actor, outletId);
    const body = await parseJson(request, createProductSchema);
    const result = await productRepository.createWithSku(
      actor.organizationId,
      {
        name: body.name,
        category: body.category,
        imageUrl: body.imageUrl ?? null,
        voidWindowHours: body.voidWindowHours,
        refundWindowHours: body.refundWindowHours,
      },
      {
        sku: body.sku.sku,
        barcode: body.sku.barcode,
        name: body.sku.name,
        imageUrl: body.sku.imageUrl ?? null,
        baseUnitId: body.sku.baseUnitId,
        saleUnitId: body.sku.saleUnitId,
        saleUnitToBaseFactor: fixed(body.sku.saleUnitToBaseFactor, 6),
        price: fixed(body.sku.price),
        cost: fixed(body.sku.cost, 6),
        minStockBaseQty: fixed(body.sku.minStockBaseQty, 3),
        trackInventory: body.sku.trackInventory,
        quantityMode: body.sku.quantityMode,
      },
      outletId,
    );

    await writeAudit({
      actor,
      action: "product.create",
      entityType: "product",
      entityId: result.product.id,
      after: result,
      request,
    });
    return created(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
