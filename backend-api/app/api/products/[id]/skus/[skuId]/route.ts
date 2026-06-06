import { productRepository } from "@/backend/repositories/product-repository";
import { writeAudit } from "@/lib/audit";
import { ApiError, handleRouteError, ok } from "@/lib/http";
import { deleteImageObjectByUrl } from "@/lib/local-image-storage";
import { requireActor, requireOutletAccess, requirePermission } from "@/lib/rbac";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ id: string; skuId: string }>;
};

export async function DELETE(request: Request, { params }: Params) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "products", "delete");
    const { id, skuId } = await params;
    const outletId = new URL(request.url).searchParams.get("outletId");
    if (outletId) await requireOutletAccess(actor, outletId);

    const result = await productRepository.transaction(async (tx) => {
      const [existingProduct] = await productRepository.findById(tx, id, actor.organizationId);
      if (!existingProduct) throw new ApiError("NOT_FOUND", "Product not found", 404);
      if (outletId && existingProduct.outletId !== outletId) {
        throw new ApiError("FORBIDDEN", "Produk ini milik outlet lain. Pilih outlet produk yang sesuai.", 403);
      }

      const [existingSku] = await productRepository.findSku(tx, skuId, id, actor.organizationId);
      if (!existingSku) throw new ApiError("NOT_FOUND", "SKU not found", 404);

      const usage = await productRepository.findSkuDeleteUsage(tx, skuId, actor.organizationId);
      const usageTotal =
        usage.saleItems +
        usage.stockMovements +
        usage.purchaseItems +
        usage.opnameItems +
        usage.batches +
        usage.promotions +
        usage.nonZeroBalances;
      if (usageTotal > 0) {
        throw new ApiError(
          "CONFLICT",
          "Varian sudah punya transaksi, stok, opname, pembelian, batch, atau promo. Nonaktifkan varian agar histori tetap aman.",
          409,
          usage,
        );
      }

      const [deletedSku] = await productRepository.deleteSku(tx, skuId, id, actor.organizationId);
      return { product: existingProduct, sku: deletedSku };
    });

    await writeAudit({
      actor,
      action: "product.sku.delete",
      entityType: "sku",
      entityId: result.sku.id,
      before: result,
      request,
    });

    await deleteImageObjectByUrl(result.sku.imageUrl);

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
