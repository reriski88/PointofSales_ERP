import { financeRepository } from "@/backend/repositories/finance-repository";
import { customerRepository } from "@/backend/repositories/customer-repository";
import { writeAudit } from "@/lib/audit";
import { decimal, fixed } from "@/lib/number";
import { ApiError, created, handleRouteError, parseJson } from "@/lib/http";
import { requireActor, requireOutletAccess, requirePermission } from "@/lib/rbac";
import { publishRealtimeEvent } from "@/lib/realtime";
import { createCustomerReceivablePaymentSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor(request);
    await requirePermission(actor, "customers", "create");
    const { id } = await params;
    const body = await parseJson(request, createCustomerReceivablePaymentSchema);
    const result = await customerRepository.transaction(async (tx) => {
      const [receivable] = await customerRepository.findReceivable(tx, id, actor.organizationId);
      if (!receivable) {
        throw new ApiError("NOT_FOUND", "Piutang pelanggan tidak ditemukan", 404);
      }
      await requireOutletAccess(actor, receivable.outletId);
      if (receivable.status === "paid" || receivable.status === "voided") {
        throw new ApiError("CONFLICT", "Piutang ini sudah tidak bisa dibayar", 409);
      }
      const nextPaidTotal = decimal(receivable.paidTotal) + body.amount;
      const amount = decimal(receivable.amount);
      if (nextPaidTotal > amount + 0.000001) {
        throw new ApiError("BAD_REQUEST", "Nominal pembayaran melebihi sisa piutang", 400);
      }
      const status = nextPaidTotal >= amount ? "paid" : "partial";
      const [payment] = await customerRepository.createReceivablePayment(tx, {
        receivableId: receivable.id,
        method: body.method,
        amount: fixed(body.amount),
        reference: body.reference,
        note: body.note,
        actorUserId: actor.id,
      });
      const [updatedReceivable] = await customerRepository.updateReceivable(tx, receivable.id, {
        paidTotal: fixed(nextPaidTotal),
        status,
        updatedAt: new Date(),
      });
      await financeRepository.postReceivablePayment(tx, {
        organizationId: actor.organizationId,
        outletId: receivable.outletId,
        paymentId: payment.id,
        saleId: receivable.saleId,
        method: body.method,
        amount: body.amount,
        actorUserId: actor.id,
      });
      return { receivable: updatedReceivable, payment };
    });
    await writeAudit({
      actor,
      action: "customer_receivable.payment",
      entityType: "customer_receivable",
      entityId: id,
      after: result,
      request,
    });
    publishRealtimeEvent({
      organizationId: actor.organizationId,
      outletId: result.receivable.outletId,
      topics: ["customers", "dashboard"],
      type: "customer_receivable.payment.created",
      payload: {
        receivableId: result.receivable.id,
        paymentId: result.payment.id,
        status: result.receivable.status,
      },
    });
    return created(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
