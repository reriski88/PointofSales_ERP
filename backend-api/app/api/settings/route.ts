import { organizationRepository } from "@/backend/repositories/organization-repository";
import { handleRouteError, ok, parseJson } from "@/lib/http";
import { deleteReplacedImageObject } from "@/lib/local-image-storage";
import { requireActor, requirePermission } from "@/lib/rbac";
import { publishRealtimeEvent } from "@/lib/realtime";
import { sanitizeReceiptLayoutSettings, updateSettingsSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const [row] = await organizationRepository.findSettings(actor.organizationId);

    return ok({
      ...row,
      receiptLayout: row.receiptLayout ? sanitizeReceiptLayoutSettings(row.receiptLayout) : row.receiptLayout,
    });
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
    if (body.posSettings !== undefined) {
      await requirePermission(actor, "promotions", "edit");
    }

    const receiptLayout = body.receiptLayout ? sanitizeReceiptLayoutSettings(body.receiptLayout) : body.receiptLayout;
    const [existing] = await organizationRepository.findSettings(actor.organizationId);

    const [updated] = await organizationRepository.updateSettings(actor.organizationId, {
        ...(body.defaultOutletLogoUrl !== undefined
          ? { logoUrl: body.defaultOutletLogoUrl }
          : {}),
        ...(body.receiptLayout !== undefined
          ? { receiptLayout }
          : {}),
        ...(body.posSettings !== undefined
          ? { posSettings: body.posSettings }
          : {}),
        updatedAt: new Date(),
      });

    if (body.defaultOutletLogoUrl !== undefined) {
      await deleteReplacedImageObject(existing?.defaultOutletLogoUrl, updated.defaultOutletLogoUrl);
    }

    publishRealtimeEvent({
      organizationId: actor.organizationId,
      topics: [
        "settings",
        ...(body.posSettings !== undefined ? ["promotions" as const] : []),
        ...(body.receiptLayout !== undefined ? ["sales" as const] : []),
        ...(body.defaultOutletLogoUrl !== undefined ? ["masterData" as const] : []),
      ],
      type: "settings.updated",
      payload: {
        receiptLayout: body.receiptLayout !== undefined,
        posSettings: body.posSettings !== undefined,
        defaultOutletLogoUrl: body.defaultOutletLogoUrl !== undefined,
      },
    });

    return ok(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}
