import { productRepository } from "@/backend/repositories/product-repository";
import { writeAudit } from "@/lib/audit";
import { ApiError, handleRouteError, ok, parseJson } from "@/lib/http";
import { deleteReplacedImageObject } from "@/lib/local-image-storage";
import { fixed } from "@/lib/number";
import { requireActor, requireOutletAccess, requirePermission } from "@/lib/rbac";
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
    const outletId = new URL(request.url).searchParams.get("outletId");
    if (outletId) {
      await requireOutletAccess(actor, outletId);
    }
    const body = await parseJson(request, updateProductSchema);

    const result = await productRepository.transaction(async (tx) => {
      const [existingProduct] = await productRepository.findById(tx, id, actor.organizationId);

      if (!existingProduct) {
        throw new ApiError("NOT_FOUND", "Product not found", 404);
      }

      if (outletId && existingProduct.outletId !== outletId) {
        throw new ApiError("FORBIDDEN", "Produk ini milik outlet lain. Pilih outlet produk yang sesuai.", 403);
      }

      const [updatedProduct] = await productRepository.updateProduct(tx, id, actor.organizationId, {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.category !== undefined ? { category: body.category } : {}),
          ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl } : {}),
          ...(body.voidWindowHours !== undefined ? { voidWindowHours: body.voidWindowHours } : {}),
          ...(body.refundWindowHours !== undefined ? { refundWindowHours: body.refundWindowHours } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          updatedAt: new Date(),
        });

      const updatedSkus = [];
      const replacedSkuImages: Array<{ before: string | null | undefined; after: string | null | undefined }> = [];
      for (const item of body.skus ?? []) {
        if (!item.id) {
          if (
            !item.sku ||
            !item.name ||
            !item.baseUnitId ||
            !item.saleUnitId ||
            item.saleUnitToBaseFactor === undefined ||
            item.price === undefined
          ) {
            throw new ApiError("BAD_REQUEST", "Data varian baru belum lengkap", 400);
          }
          const createdSku = await productRepository.createSku(
            tx,
            actor.organizationId,
            id,
            {
              sku: item.sku,
              barcode: item.barcode ?? null,
              name: item.name,
              imageUrl: item.imageUrl ?? null,
              baseUnitId: item.baseUnitId,
              saleUnitId: item.saleUnitId,
              saleUnitToBaseFactor: fixed(item.saleUnitToBaseFactor, 6),
              price: fixed(item.price),
              cost: fixed(item.cost ?? 0, 6),
              minStockBaseQty: fixed(item.minStockBaseQty ?? 0, 3),
              trackInventory: item.trackInventory ?? true,
              quantityMode: item.quantityMode ?? "required",
              isActive: item.isActive ?? true,
            },
            outletId ?? undefined,
          );
          updatedSkus.push(createdSku);
          continue;
        }

        const [existingSku] = await productRepository.findSku(tx, item.id, id, actor.organizationId);

        if (!existingSku) {
          throw new ApiError("NOT_FOUND", `SKU ${item.id} not found`, 404);
        }

        const [updatedSku] = await productRepository.updateSku(tx, item.id, id, actor.organizationId, {
            ...(item.sku !== undefined ? { sku: item.sku } : {}),
            ...(item.barcode !== undefined ? { barcode: item.barcode } : {}),
            ...(item.name !== undefined ? { name: item.name } : {}),
            ...(item.imageUrl !== undefined ? { imageUrl: item.imageUrl } : {}),
            ...(item.baseUnitId !== undefined ? { baseUnitId: item.baseUnitId } : {}),
            ...(item.saleUnitId !== undefined ? { saleUnitId: item.saleUnitId } : {}),
            ...(item.saleUnitToBaseFactor !== undefined
              ? { saleUnitToBaseFactor: fixed(item.saleUnitToBaseFactor, 6) }
              : {}),
            ...(item.price !== undefined ? { price: fixed(item.price) } : {}),
            ...(item.cost !== undefined ? { cost: fixed(item.cost, 6) } : {}),
            ...(item.minStockBaseQty !== undefined ? { minStockBaseQty: fixed(item.minStockBaseQty, 3) } : {}),
            ...(item.trackInventory !== undefined ? { trackInventory: item.trackInventory } : {}),
            ...(item.quantityMode !== undefined ? { quantityMode: item.quantityMode } : {}),
            ...(item.isActive !== undefined ? { isActive: item.isActive } : {}),
            updatedAt: new Date(),
          });
        replacedSkuImages.push({ before: existingSku.imageUrl, after: updatedSku.imageUrl });
        updatedSkus.push(updatedSku);
      }

      return {
        before: existingProduct,
        product: updatedProduct,
        skus: updatedSkus,
        replacedSkuImages,
      };
    });

    await deleteReplacedImageObject(result.before.imageUrl, result.product.imageUrl);
    for (const item of result.replacedSkuImages) {
      await deleteReplacedImageObject(item.before, item.after);
    }

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
