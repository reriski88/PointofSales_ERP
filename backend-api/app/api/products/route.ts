import { productRepository } from "@/backend/repositories/product-repository";
import { writeAudit } from "@/lib/audit";
import { fixed } from "@/lib/number";
import { ApiError, created, handleRouteError, ok, parseJson } from "@/lib/http";
import { requireActor, requireOutletAccess, requirePermission } from "@/lib/rbac";
import { createProductSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "products", "view");
    const outletId = new URL(request.url).searchParams.get("outletId");
    if (!outletId) {
      throw new ApiError("BAD_REQUEST", "outletId is required", 400);
    }
    await requireOutletAccess(actor, outletId);
    const [rows, outletSkus] = await Promise.all([
      productRepository.findManyWithSkus(actor.organizationId),
      productRepository.findSkuIdsByOutlet(outletId),
    ]);
    const outletSkuIds = new Set(outletSkus.map((row) => row.skuId));
    const visibleRows = rows
      .map((row) => ({
        ...row,
        skus: row.skus.filter((item) => outletSkuIds.has(item.id)),
      }))
      .filter((row) => row.skus.length > 0);
    return ok(visibleRows);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "products", "create");
    const outletId = new URL(request.url).searchParams.get("outletId");
    if (!outletId) {
      throw new ApiError("BAD_REQUEST", "outletId is required", 400);
    }
    await requireOutletAccess(actor, outletId);
    const body = await parseJson(request, createProductSchema);
    const result = await productRepository.createWithSku(
      actor.organizationId,
      {
        name: body.name,
        category: body.category,
      },
      {
        sku: body.sku.sku,
        barcode: body.sku.barcode,
        name: body.sku.name,
        baseUnitId: body.sku.baseUnitId,
        saleUnitId: body.sku.saleUnitId,
        saleUnitToBaseFactor: fixed(body.sku.saleUnitToBaseFactor, 6),
        price: fixed(body.sku.price),
        cost: fixed(body.sku.cost, 6),
        minStockBaseQty: fixed(body.sku.minStockBaseQty, 3),
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
