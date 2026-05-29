import { auditRepository } from "@/backend/repositories/audit-repository";
import type { Actor } from "@/lib/rbac";

export async function writeAudit(input: {
  actor?: Actor;
  organizationId?: string;
  outletId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  note?: string;
  request?: Request;
}) {
  await auditRepository.create({
    organizationId: input.organizationId ?? input.actor?.organizationId,
    outletId: input.outletId,
    actorUserId: input.actor?.id,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    before: input.before,
    after: input.after,
    note: input.note,
    ipAddress: input.request?.headers.get("x-forwarded-for") ?? input.request?.headers.get("cf-connecting-ip"),
    userAgent: input.request?.headers.get("user-agent"),
  });
}
