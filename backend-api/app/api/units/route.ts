import { unitRepository } from "@/backend/repositories/unit-repository";
import { writeAudit } from "@/lib/audit";
import { fixed } from "@/lib/number";
import { created, handleRouteError, ok, parseJson } from "@/lib/http";
import { requireActor, requirePermission } from "@/lib/rbac";
import { createUnitSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "products", "view");
    const rows = await unitRepository.findByOrganization(actor.organizationId);
    return ok(rows);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "products", "create");
    const body = await parseJson(request, createUnitSchema);
    const [row] = await unitRepository.create({
        organizationId: actor.organizationId,
        name: body.name.trim(),
        code: body.code.trim().toUpperCase(),
        kind: body.kind,
        toBaseFactor: fixed(body.toBaseFactor, 6),
      });
    await writeAudit({
      actor,
      action: "unit.create",
      entityType: "unit",
      entityId: row.id,
      after: row,
      request,
    });
    return created(row);
  } catch (error) {
    return handleRouteError(error);
  }
}
