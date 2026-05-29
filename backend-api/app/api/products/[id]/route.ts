import { productRepository } from "@/backend/repositories/product-repository";
import { writeAudit } from "@/lib/audit";
import { ApiError, handleRouteError, ok, parseJson } from "@/lib/http";
import { fixed } from "@/lib/number";
import { requireActor, requirePermission } from "@/lib/rbac";
import { updateProductSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "products", "edit");
    const { id } = await params;
    const body = await parseJson(request, updateProductSchema);

    const result = await productRepository.transaction(async (tx) => {
      const [existingProduct] = await productRepository.findById(tx, id, actor.organizationId);

      if (!existingProduct) {
        throw new ApiError("NOT_FOUND", "Product not found", 404);
      }

      const [updatedProduct] = await productRepository.updateProduct(tx, id, actor.organizationId, {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.category !== undefined ? { category: body.category } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          updatedAt: new Date(),
        });

      const updatedSkus = [];
      for (const item of body.skus ?? []) {
        const [existingSku] = await productRepository.findSku(tx, item.id, id, actor.organizationId);

        if (!existingSku) {
          throw new ApiError("NOT_FOUND", `SKU ${item.id} not found`, 404);
        }

        const [updatedSku] = await productRepository.updateSku(tx, item.id, id, actor.organizationId, {
            ...(item.sku !== undefined ? { sku: item.sku } : {}),
            ...(item.barcode !== undefined ? { barcode: item.barcode } : {}),
            ...(item.name !== undefined ? { name: item.name } : {}),
            ...(item.baseUnitId !== undefined ? { baseUnitId: item.baseUnitId } : {}),
            ...(item.saleUnitId !== undefined ? { saleUnitId: item.saleUnitId } : {}),
            ...(item.saleUnitToBaseFactor !== undefined
              ? { saleUnitToBaseFactor: fixed(item.saleUnitToBaseFactor, 6) }
              : {}),
            ...(item.price !== undefined ? { price: fixed(item.price) } : {}),
            ...(item.cost !== undefined ? { cost: fixed(item.cost, 6) } : {}),
            ...(item.minStockBaseQty !== undefined ? { minStockBaseQty: fixed(item.minStockBaseQty, 3) } : {}),
            ...(item.isActive !== undefined ? { isActive: item.isActive } : {}),
            updatedAt: new Date(),
          });
        updatedSkus.push(updatedSku);
      }

      return {
        before: existingProduct,
        product: updatedProduct,
        skus: updatedSkus,
      };
    });

    await writeAudit({
      actor,
      action: "product.update",
      entityType: "product",
      entityId: result.product.id,
      before: result.before,
      after: {
        product: result.product,
        skus: result.skus,
      },
      request,
    });

    return ok({
      product: result.product,
      skus: result.skus,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
