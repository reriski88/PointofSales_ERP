import { organizationRepository } from "@/backend/repositories/organization-repository";
import { handleRouteError, ok, parseJson } from "@/lib/http";
import { requireActor, requirePermission } from "@/lib/rbac";
import { updateSettingsSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const [row] = await organizationRepository.findSettings(actor.organizationId);

    return ok(row);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireActor(request);
    const body = await parseJson(request, updateSettingsSchema);
    if (body.defaultOutletLogoUrl !== undefined) {
      await requirePermission(actor, "outlets", "edit");
    }
    if (body.receiptLayout !== undefined) {
      await requirePermission(actor, "receipt", "edit");
    }

    const [updated] = await organizationRepository.updateSettings(actor.organizationId, {
        ...(body.defaultOutletLogoUrl !== undefined
          ? { logoUrl: body.defaultOutletLogoUrl }
          : {}),
        ...(body.receiptLayout !== undefined
          ? { receiptLayout: body.receiptLayout }
          : {}),
        updatedAt: new Date(),
      });

    return ok(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}
