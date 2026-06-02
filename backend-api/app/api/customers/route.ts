import { customerRepository } from "@/backend/repositories/customer-repository";
import { writeAudit } from "@/lib/audit";
import { created, handleRouteError, ok, parseJson } from "@/lib/http";
import { requireActor, requirePermission } from "@/lib/rbac";
import { publishRealtimeEvent } from "@/lib/realtime";
import { createCustomerSchema } from "@/lib/validation";

export const runtime = "nodejs";

function makeCustomerCode() {
  return `CUST-${Date.now().toString(36).toUpperCase()}`;
}

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "customers", "view");
    const rows = await customerRepository.findCustomers(actor.organizationId);
    return ok(rows);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "customers", "create");
    const body = await parseJson(request, createCustomerSchema);
    const [row] = await customerRepository.createCustomer({
      organizationId: actor.organizationId,
      code: body.code ?? makeCustomerCode(),
      name: body.name,
      phone: body.phone,
      address: body.address,
    });
    await writeAudit({
      actor,
      action: "customer.create",
      entityType: "customer",
      entityId: row.id,
      after: row,
      request,
    });
    publishRealtimeEvent({
      organizationId: actor.organizationId,
      topics: ["customers"],
      type: "customer.created",
      payload: { customerId: row.id },
    });
    return created(row);
  } catch (error) {
    return handleRouteError(error);
  }
}
