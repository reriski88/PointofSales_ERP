import { dashboardRepository } from "@/backend/repositories/dashboard-repository";
import { promotionRepository } from "@/backend/repositories/promotion-repository";
import { reportRepository } from "@/backend/repositories/report-repository";
import { ApiError, handleRouteError, ok, parseJson } from "@/lib/http";
import { accessibleOutletIds, requireActor, requireRole } from "@/lib/rbac";
import { z } from "zod";

export const runtime = "nodejs";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(2000),
});

const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(16),
});

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message?: string };
};

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    requireRole(actor, ["owner", "admin_outlet"]);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ApiError("INTERNAL_ERROR", "GEMINI_API_KEY belum diatur.", 503);
    }

    const body = await parseJson(request, chatRequestSchema);
    const context = await buildApplicationContext(actor);
    const model = process.env.GEMINI_CHAT_MODEL ?? "gemini-2.0-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: buildInstructions(context) }],
          },
          contents: body.messages.map((message) => ({
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: message.content }],
          })),
          generationConfig: {
            maxOutputTokens: 900,
            temperature: 0.2,
          },
        }),
      },
    );

    const data = (await response.json().catch(() => ({}))) as GeminiResponse;
    if (!response.ok) {
      throw new ApiError(
        "INTERNAL_ERROR",
        data.error?.message ?? "Gemini gagal menjawab.",
        response.status,
      );
    }

    const answer = extractOutputText(data).trim();
    if (!answer) {
      throw new ApiError(
        "INTERNAL_ERROR",
        "Gemini tidak mengirim jawaban.",
        502,
      );
    }

    return ok({ message: answer });
  } catch (error) {
    return handleRouteError(error);
  }
}

async function buildApplicationContext(
  actor: Awaited<ReturnType<typeof requireActor>>,
) {
  const outletIds = await accessibleOutletIds(actor);
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const lastWeek = addDays(today, -6);

  const [dashboard, todaySales, weeklySales, inventory, payments, promotions] =
    await Promise.all([
      dashboardRepository.getSummary({
        organizationId: actor.organizationId,
        actorRole: actor.role,
        outletIds,
        chart: {
          mode: "daily",
          unit: "day",
          label: "7 hari terakhir",
          periods: daysBetween(lastWeek, today),
        },
      }),
      aggregateSalesSummary(
        actor.organizationId,
        outletIds,
        today.toISOString(),
        tomorrow.toISOString(),
      ),
      aggregateSalesSummary(
        actor.organizationId,
        outletIds,
        lastWeek.toISOString(),
        tomorrow.toISOString(),
      ),
      aggregateInventorySummary(actor.organizationId, outletIds),
      aggregatePaymentSummary(
        actor.organizationId,
        outletIds,
        today.toISOString(),
        tomorrow.toISOString(),
      ),
      promotionRepository.findActiveMany(actor.organizationId),
    ]);

  return {
    actor: {
      name: actor.name,
      role: actor.role,
    },
    generatedAt: new Date().toISOString(),
    scope: "Admin web POS ERP only. Flutter/mobile is out of scope.",
    appWorkflow: [
      "Dashboard menampilkan statistik outlet, produk/SKU, user, penjualan hari ini, grafik, produk terlaris, dan alert stok.",
      "Kasir web memproses buka/tutup shift, keranjang, pembayaran, promo, donasi, pembulatan, sync offline, dan input remahan.",
      "Master data mengelola outlet, produk/SKU, pelanggan, promo, inventory, transfer stok, stock opname, supplier, pembelian, user, role akses, dan layout struk.",
      "Laporan web mencakup penjualan, inventory, remahan, piutang/pelanggan, dan laporan finansial sesuai role akses.",
    ],
    accessibleOutletCount: outletIds.length,
    dashboard,
    todaySales,
    weeklySales,
    inventory,
    paymentsToday: payments,
    activePromotions: promotions.map((promo) => ({
      name: promo.name,
      code: promo.code,
      type: promo.type,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      minSubtotal: promo.minSubtotal,
      scope: promo.scope,
      targetCategory: promo.targetCategory,
      redeemedCount: promo.redeemedCount,
      maxRedemptions: promo.maxRedemptions,
    })),
  };
}

async function aggregateSalesSummary(
  organizationId: string,
  outletIds: string[],
  from: string,
  to: string,
) {
  const rows = await Promise.all(
    outletIds.map((outletId) =>
      reportRepository.salesSummary(organizationId, outletId, from, to),
    ),
  );
  return rows
    .flatMap((row) => row)
    .reduce(
      (summary, row) => ({
        transactionCount:
          summary.transactionCount + (row.transactionCount ?? 0),
        grossSales: addNumericText(summary.grossSales, row.grossSales),
        netSales: addNumericText(summary.netSales, row.netSales),
        cogs: addNumericText(summary.cogs, row.cogs),
        grossProfit: addNumericText(summary.grossProfit, row.grossProfit),
      }),
      {
        transactionCount: 0,
        grossSales: "0",
        netSales: "0",
        cogs: "0",
        grossProfit: "0",
      },
    );
}

async function aggregateInventorySummary(
  organizationId: string,
  outletIds: string[],
) {
  const rows = await Promise.all(
    outletIds.map((outletId) =>
      reportRepository.inventorySummary(organizationId, outletId),
    ),
  );
  return rows
    .flatMap((row) => row)
    .reduce(
      (summary, row) => ({
        skuCount: summary.skuCount + (row.skuCount ?? 0),
        totalOnHandBaseQty: addNumericText(
          summary.totalOnHandBaseQty,
          row.totalOnHandBaseQty,
        ),
        totalAvailableBaseQty: addNumericText(
          summary.totalAvailableBaseQty,
          row.totalAvailableBaseQty,
        ),
        criticalStockCount:
          summary.criticalStockCount + (row.criticalStockCount ?? 0),
      }),
      {
        skuCount: 0,
        totalOnHandBaseQty: "0",
        totalAvailableBaseQty: "0",
        criticalStockCount: 0,
      },
    );
}

async function aggregatePaymentSummary(
  organizationId: string,
  outletIds: string[],
  from: string,
  to: string,
) {
  const rows = await Promise.all(
    outletIds.map((outletId) =>
      reportRepository.paymentSummary(organizationId, outletId, from, to),
    ),
  );
  const byMethod = new Map<string, string>();
  for (const row of rows.flatMap((item) => item)) {
    byMethod.set(
      row.method,
      addNumericText(byMethod.get(row.method) ?? "0", row.amount),
    );
  }
  return [...byMethod.entries()].map(([method, amount]) => ({
    method,
    amount,
  }));
}

function buildInstructions(context: unknown) {
  return [
    "Kamu adalah asisten AI internal untuk aplikasi web POS ERP.",
    "Jawab hanya tentang data, cara kerja, fitur, dan operasional aplikasi web ini.",
    "Jika pertanyaan di luar aplikasi web POS ERP, tolak singkat dan arahkan kembali ke data/cara kerja aplikasi.",
    "Jangan membahas Flutter/mobile kecuali untuk mengatakan fitur ini hanya web.",
    "Gunakan konteks data yang diberikan. Jika data tidak tersedia di konteks, katakan data belum tersedia dan sarankan menu web yang relevan.",
    "Jangan mengarang angka, transaksi, stok, atau konfigurasi.",
    "Jawab dalam Bahasa Indonesia, ringkas, dan praktis untuk admin.",
    `Konteks aplikasi dan data saat ini:\n${JSON.stringify(context, null, 2)}`,
  ].join("\n\n");
}

function extractOutputText(data: GeminiResponse) {
  return (
    data.candidates
      ?.flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("\n") ?? ""
  );
}

function addNumericText(
  left: string | number | null | undefined,
  right: string | number | null | undefined,
) {
  return (Number(left ?? 0) + Number(right ?? 0)).toString();
}

function startOfDay(value: Date) {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(from: Date, to: Date) {
  const days = [];
  for (let cursor = new Date(from); cursor <= to; cursor = addDays(cursor, 1)) {
    days.push(new Date(cursor));
  }
  return days;
}
