import { customerRepository } from "@/backend/repositories/customer-repository";
import { writeAudit } from "@/lib/audit";
import { created, handleRouteError, ok, parseJson, parseListQuery } from "@/lib/http";
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
    const listQuery = parseListQuery(new URL(request.url).searchParams);
    const rows = await customerRepository.findCustomers(actor.organizationId, listQuery);
    if (listQuery.limit) {
      return ok({
        items: rows,
        page: listQuery.page ?? Math.floor((listQuery.offset ?? 0) / listQuery.limit) + 1,
        limit: listQuery.limit,
        offset: listQuery.offset ?? 0,
        hasMore: rows.length === listQuery.limit,
      });
    }
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
