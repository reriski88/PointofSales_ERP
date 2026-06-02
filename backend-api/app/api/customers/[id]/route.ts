import { customerRepository } from "@/backend/repositories/customer-repository";
import { writeAudit } from "@/lib/audit";
import { ApiError, handleRouteError, ok, parseJson } from "@/lib/http";
import { requireActor, requirePermission } from "@/lib/rbac";
import { publishRealtimeEvent } from "@/lib/realtime";
import { updateCustomerSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "customers", "edit");
    const { id } = await params;
    const body = await parseJson(request, updateCustomerSchema);
    const [row] = await customerRepository.updateCustomer(id, actor.organizationId, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.code !== undefined ? { code: body.code } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.address !== undefined ? { address: body.address } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      updatedAt: new Date(),
    });
    if (!row) {
      throw new ApiError("NOT_FOUND", "Pelanggan tidak ditemukan", 404);
    }
    await writeAudit({
      actor,
      action: "customer.update",
      entityType: "customer",
      entityId: row.id,
      after: row,
      request,
    });
    publishRealtimeEvent({
      organizationId: actor.organizationId,
      topics: ["customers"],
      type: "customer.updated",
      payload: { customerId: row.id },
    });
    return ok(row);
  } catch (error) {
    return handleRouteError(error);
  }
}
