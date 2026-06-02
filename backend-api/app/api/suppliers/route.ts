import { purchaseRepository } from "@/backend/repositories/purchase-repository";
import { writeAudit } from "@/lib/audit";
import { created, handleRouteError, ok, parseJson } from "@/lib/http";
import { requireActor, requirePermission } from "@/lib/rbac";
import { createSupplierSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "suppliers", "view");
    const rows = await purchaseRepository.findSuppliers(actor.organizationId);
    return ok(rows);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "suppliers", "create");
    const body = await parseJson(request, createSupplierSchema);
    const [row] = await purchaseRepository.createSupplier({
      organizationId: actor.organizationId,
      name: body.name,
      code: body.code,
      phone: body.phone,
      address: body.address,
    });

    await writeAudit({
      actor,
      action: "supplier.create",
      entityType: "supplier",
      entityId: row.id,
      after: row,
      request,
    });

    return created(row);
  } catch (error) {
    return handleRouteError(error);
  }
}
