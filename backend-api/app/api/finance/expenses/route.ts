import { financeRepository } from "@/backend/repositories/finance-repository";
import { created, handleRouteError, ok, parseJson } from "@/lib/http";
import { requireActor, requireOutletAccess, requirePermission } from "@/lib/rbac";
import { createOperationalExpenseSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "financialReports", "view");
    const rows = await financeRepository.listOperationalExpenses(actor.organizationId);
    return ok(rows);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "financialReports", "create");
    const body = await parseJson(request, createOperationalExpenseSchema);
    if (body.outletId) {
      await requireOutletAccess(actor, body.outletId);
    }
    const expense = await financeRepository.transaction((tx) =>
      financeRepository.createOperationalExpense(tx, {
        organizationId: actor.organizationId,
        outletId: body.outletId,
        amount: body.amount,
        method: body.method,
        vendor: body.vendor,
        description: body.description,
        expenseDate: body.expenseDate ? new Date(body.expenseDate) : undefined,
        actorUserId: actor.id,
      }),
    );
    return created(expense);
  } catch (error) {
    return handleRouteError(error);
  }
}
