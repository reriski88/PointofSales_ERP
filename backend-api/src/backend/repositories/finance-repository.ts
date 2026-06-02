import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  accountingAccount,
  cashBankLedger,
  journalEntry,
  journalLine,
  operationalExpense,
  type AccountingAccountType,
  type AccountingNormalBalance,
  type PaymentMethod,
} from "@/db/schema";
import { fixed } from "@/lib/number";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const defaultAccounts = [
  ["1010", "Kas Tunai", "asset", "debit"],
  ["1020", "Bank / Transfer", "asset", "debit"],
  ["1030", "QRIS Clearing", "asset", "debit"],
  ["1040", "Kartu Clearing", "asset", "debit"],
  ["1050", "E-Wallet Clearing", "asset", "debit"],
  ["1090", "Kas/Bank Lainnya", "asset", "debit"],
  ["1100", "Piutang Usaha", "asset", "debit"],
  ["1200", "Persediaan Barang", "asset", "debit"],
  ["1210", "Uang Muka Pembelian", "asset", "debit"],
  ["2010", "Hutang Usaha", "liability", "credit"],
  ["2110", "Pajak Keluaran", "liability", "credit"],
  ["2210", "Titipan Donasi", "liability", "credit"],
  ["3000", "Modal Pemilik", "equity", "credit"],
  ["4000", "Penjualan", "revenue", "credit"],
  ["4010", "Potongan Penjualan", "revenue", "debit"],
  ["4100", "Service Charge", "revenue", "credit"],
  ["4300", "Pembulatan Penjualan", "revenue", "credit"],
  ["5000", "Harga Pokok Penjualan", "cogs", "debit"],
  ["6000", "Biaya Operasional", "expense", "debit"],
] as const satisfies ReadonlyArray<readonly [string, string, AccountingAccountType, AccountingNormalBalance]>;

const methodAccountCode: Record<PaymentMethod, string> = {
  cash: "1010",
  transfer: "1020",
  qris: "1030",
  card: "1040",
  ewallet: "1050",
  other: "1090",
};

type JournalLineInput = {
  accountCode: string;
  debit?: number;
  credit?: number;
  memo?: string;
};

type PaymentInput = {
  method: PaymentMethod;
  amount: number;
};

export const financeRepository = {
  transaction<T>(callback: (tx: Tx) => Promise<T>) {
    return db.transaction(callback);
  },

  async ensureDefaultAccounts(tx: Tx, organizationId: string) {
    for (const [code, name, type, normalBalance] of defaultAccounts) {
      await tx
        .insert(accountingAccount)
        .values({
          organizationId,
          code,
          name,
          type,
          normalBalance,
          isSystem: true,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: [accountingAccount.organizationId, accountingAccount.code],
          set: {
            name,
            type,
            normalBalance,
            isSystem: true,
            isActive: true,
            updatedAt: new Date(),
          },
        });
    }

    return tx.select().from(accountingAccount).where(eq(accountingAccount.organizationId, organizationId));
  },

  async createJournal(
    tx: Tx,
    input: {
      organizationId: string;
      outletId?: string | null;
      sourceType: string;
      sourceId: string;
      description: string;
      actorUserId?: string | null;
      entryDate?: Date;
      lines: JournalLineInput[];
    },
  ) {
    const existing = await tx
      .select({ id: journalEntry.id })
      .from(journalEntry)
      .where(
        and(
          eq(journalEntry.organizationId, input.organizationId),
          eq(journalEntry.sourceType, input.sourceType),
          eq(journalEntry.sourceId, input.sourceId),
          eq(journalEntry.status, "posted"),
        ),
      )
      .limit(1);

    if (existing[0]) {
      return existing[0];
    }

    const accounts = await this.ensureDefaultAccounts(tx, input.organizationId);
    const accountByCode = new Map(accounts.map((account) => [account.code, account]));
    const preparedLines = input.lines
      .map((line) => ({
        ...line,
        debit: roundMoney(line.debit ?? 0),
        credit: roundMoney(line.credit ?? 0),
      }))
      .filter((line) => line.debit > 0 || line.credit > 0);

    const debitTotal = roundMoney(preparedLines.reduce((sum, line) => sum + line.debit, 0));
    const creditTotal = roundMoney(preparedLines.reduce((sum, line) => sum + line.credit, 0));
    if (preparedLines.length < 2 || Math.abs(debitTotal - creditTotal) > 0.009) {
      throw new Error(`Jurnal tidak seimbang: debit ${debitTotal}, kredit ${creditTotal}`);
    }

    const [entry] = await tx
      .insert(journalEntry)
      .values({
        organizationId: input.organizationId,
        outletId: input.outletId,
        entryNumber: makeEntryNumber(input.sourceType),
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        entryDate: input.entryDate ?? new Date(),
        description: input.description,
        actorUserId: input.actorUserId,
      })
      .returning({ id: journalEntry.id });

    for (const line of preparedLines) {
      const account = accountByCode.get(line.accountCode);
      if (!account) {
        throw new Error(`Akun ${line.accountCode} belum tersedia`);
      }
      await tx.insert(journalLine).values({
        journalEntryId: entry.id,
        accountId: account.id,
        debit: fixed(line.debit),
        credit: fixed(line.credit),
        memo: line.memo,
      });
    }

    return entry;
  },

  async createCashLedger(
    tx: Tx,
    input: {
      organizationId: string;
      outletId?: string | null;
      journalEntryId?: string | null;
      sourceType: string;
      sourceId: string;
      method: PaymentMethod;
      direction: "in" | "out";
      amount: number;
      description: string;
      actorUserId?: string | null;
      occurredAt?: Date;
    },
  ) {
    if (input.amount <= 0) return;
    const accounts = await this.ensureDefaultAccounts(tx, input.organizationId);
    const account = accounts.find((item) => item.code === methodAccountCode[input.method]);
    await tx.insert(cashBankLedger).values({
      organizationId: input.organizationId,
      outletId: input.outletId,
      accountId: account?.id,
      journalEntryId: input.journalEntryId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      method: input.method,
      direction: input.direction,
      amount: fixed(input.amount),
      description: input.description,
      actorUserId: input.actorUserId,
      occurredAt: input.occurredAt ?? new Date(),
    });
  },

  async postSale(
    tx: Tx,
    input: {
      organizationId: string;
      outletId: string;
      saleId: string;
      receiptNumber: string;
      actorUserId: string;
      subtotal: number;
      discountTotal: number;
      taxTotal: number;
      serviceChargeTotal: number;
      donationTotal: number;
      roundingTotal: number;
      cogsTotal: number;
      receivableTotal: number;
      payments: PaymentInput[];
      taxIncluded?: boolean;
    },
  ) {
    const revenueSplit = splitIncludedTax({
      subtotal: input.subtotal,
      serviceChargeTotal: input.serviceChargeTotal,
      taxTotal: input.taxIncluded ? input.taxTotal : 0,
    });
    const paymentLines = input.payments.map((payment) => ({
      accountCode: methodAccountCode[payment.method],
      debit: payment.amount,
      memo: `Pembayaran ${input.receiptNumber}`,
    }));
    const salesEntry = await this.createJournal(tx, {
      organizationId: input.organizationId,
      outletId: input.outletId,
      sourceType: "sale",
      sourceId: input.saleId,
      description: `Penjualan ${input.receiptNumber}`,
      actorUserId: input.actorUserId,
      lines: [
        ...paymentLines,
        { accountCode: "1100", debit: input.receivableTotal, memo: "Piutang penjualan" },
        { accountCode: "4010", debit: input.discountTotal, memo: "Potongan penjualan" },
        { accountCode: "4000", credit: revenueSplit.salesRevenue, memo: "Penjualan bruto" },
        { accountCode: "2110", credit: input.taxTotal, memo: "Pajak keluaran" },
        { accountCode: "4100", credit: revenueSplit.serviceRevenue, memo: "Service charge" },
        { accountCode: "2210", credit: input.donationTotal, memo: "Titipan donasi" },
        { accountCode: "4300", credit: input.roundingTotal, memo: "Pembulatan" },
      ],
    });

    if (input.cogsTotal > 0) {
      await this.createJournal(tx, {
        organizationId: input.organizationId,
        outletId: input.outletId,
        sourceType: "sale_cogs",
        sourceId: input.saleId,
        description: `HPP ${input.receiptNumber}`,
        actorUserId: input.actorUserId,
        lines: [
          { accountCode: "5000", debit: input.cogsTotal, memo: "HPP penjualan" },
          { accountCode: "1200", credit: input.cogsTotal, memo: "Persediaan keluar" },
        ],
      });
    }

    for (const payment of input.payments) {
      await this.createCashLedger(tx, {
        organizationId: input.organizationId,
        outletId: input.outletId,
        journalEntryId: salesEntry.id,
        sourceType: "sale",
        sourceId: input.saleId,
        method: payment.method,
        direction: "in",
        amount: payment.amount,
        description: `Pembayaran ${input.receiptNumber}`,
        actorUserId: input.actorUserId,
      });
    }
  },

  async postSaleReversal(
    tx: Tx,
    input: {
      organizationId: string;
      outletId: string;
      saleId: string;
      receiptNumber: string;
      actorUserId: string;
      correctionType: "void" | "refund";
      subtotal: number;
      discountTotal: number;
      taxTotal: number;
      serviceChargeTotal: number;
      donationTotal: number;
      roundingTotal: number;
      cogsTotal: number;
      receivableTotal: number;
      settlementPayments: PaymentInput[];
      restock: boolean;
      taxIncluded?: boolean;
    },
  ) {
    const sourceType = input.correctionType === "void" ? "sale_void" : "sale_refund";
    const revenueSplit = splitIncludedTax({
      subtotal: input.subtotal,
      serviceChargeTotal: input.serviceChargeTotal,
      taxTotal: input.taxIncluded ? input.taxTotal : 0,
    });
    const paymentLines = input.settlementPayments.map((payment) => ({
      accountCode: methodAccountCode[payment.method],
      credit: payment.amount,
      memo: `${input.correctionType === "void" ? "Pembatalan" : "Refund"} ${input.receiptNumber}`,
    }));
    const reversalEntry = await this.createJournal(tx, {
      organizationId: input.organizationId,
      outletId: input.outletId,
      sourceType,
      sourceId: input.saleId,
      description: `${input.correctionType === "void" ? "Pembatalan" : "Refund"} penjualan ${input.receiptNumber}`,
      actorUserId: input.actorUserId,
      lines: [
        { accountCode: "4000", debit: revenueSplit.salesRevenue, memo: "Balik penjualan bruto" },
        { accountCode: "2110", debit: input.taxTotal, memo: "Balik pajak keluaran" },
        { accountCode: "4100", debit: revenueSplit.serviceRevenue, memo: "Balik service charge" },
        { accountCode: "2210", debit: input.donationTotal, memo: "Balik titipan donasi" },
        { accountCode: "4300", debit: input.roundingTotal, memo: "Balik pembulatan" },
        { accountCode: "4010", credit: input.discountTotal, memo: "Balik potongan penjualan" },
        { accountCode: "1100", credit: input.receivableTotal, memo: "Balik piutang penjualan" },
        ...paymentLines,
      ],
    });

    if (input.restock && input.cogsTotal > 0) {
      await this.createJournal(tx, {
        organizationId: input.organizationId,
        outletId: input.outletId,
        sourceType: `${sourceType}_cogs`,
        sourceId: input.saleId,
        description: `Balik HPP ${input.receiptNumber}`,
        actorUserId: input.actorUserId,
        lines: [
          { accountCode: "1200", debit: input.cogsTotal, memo: "Persediaan kembali" },
          { accountCode: "5000", credit: input.cogsTotal, memo: "Balik HPP penjualan" },
        ],
      });
    }

    for (const payment of input.settlementPayments) {
      await this.createCashLedger(tx, {
        organizationId: input.organizationId,
        outletId: input.outletId,
        journalEntryId: reversalEntry.id,
        sourceType,
        sourceId: input.saleId,
        method: payment.method,
        direction: "out",
        amount: payment.amount,
        description: `${input.correctionType === "void" ? "Pembatalan" : "Refund"} ${input.receiptNumber}`,
        actorUserId: input.actorUserId,
      });
    }
  },

  async postPurchaseReceipt(
    tx: Tx,
    input: {
      organizationId: string;
      outletId: string;
      purchaseOrderId: string;
      orderNumber: string;
      subtotal: number;
      actorUserId: string;
    },
  ) {
    await this.createJournal(tx, {
      organizationId: input.organizationId,
      outletId: input.outletId,
      sourceType: "purchase_receive",
      sourceId: input.purchaseOrderId,
      description: `Terima barang ${input.orderNumber}`,
      actorUserId: input.actorUserId,
      lines: [
        { accountCode: "1200", debit: input.subtotal, memo: "Persediaan masuk" },
        { accountCode: "2010", credit: input.subtotal, memo: "Hutang supplier" },
      ],
    });
  },

  async postPurchasePayment(
    tx: Tx,
    input: {
      organizationId: string;
      outletId: string;
      purchaseOrderId: string;
      paymentId: string;
      orderNumber: string;
      method: PaymentMethod;
      amount: number;
      actorUserId: string;
      isAdvance?: boolean;
    },
  ) {
    const payableOrAdvanceAccount = input.isAdvance ? "1210" : "2010";
    const entry = await this.createJournal(tx, {
      organizationId: input.organizationId,
      outletId: input.outletId,
      sourceType: "purchase_payment",
      sourceId: input.paymentId,
      description: `Pembayaran supplier ${input.orderNumber}`,
      actorUserId: input.actorUserId,
      lines: [
        {
          accountCode: payableOrAdvanceAccount,
          debit: input.amount,
          memo: input.isAdvance ? "Uang muka pembelian" : "Kurangi hutang supplier",
        },
        { accountCode: methodAccountCode[input.method], credit: input.amount, memo: "Kas/bank keluar" },
      ],
    });
    await this.createCashLedger(tx, {
      organizationId: input.organizationId,
      outletId: input.outletId,
      journalEntryId: entry.id,
      sourceType: "purchase_payment",
      sourceId: input.paymentId,
      method: input.method,
      direction: "out",
      amount: input.amount,
      description: `Pembayaran supplier ${input.orderNumber}`,
      actorUserId: input.actorUserId,
    });
  },

  async postPurchaseAdvanceSettlement(
    tx: Tx,
    input: {
      organizationId: string;
      outletId: string;
      purchaseOrderId: string;
      orderNumber: string;
      amount: number;
      actorUserId: string;
    },
  ) {
    if (input.amount <= 0) return;
    await this.createJournal(tx, {
      organizationId: input.organizationId,
      outletId: input.outletId,
      sourceType: "purchase_advance_settlement",
      sourceId: input.purchaseOrderId,
      description: `Penyelesaian uang muka ${input.orderNumber}`,
      actorUserId: input.actorUserId,
      lines: [
        { accountCode: "2010", debit: input.amount, memo: "Kurangi hutang dari uang muka" },
        { accountCode: "1210", credit: input.amount, memo: "Uang muka menjadi pelunasan hutang" },
      ],
    });
  },

  async postReceivablePayment(
    tx: Tx,
    input: {
      organizationId: string;
      outletId: string;
      paymentId: string;
      saleId: string;
      method: PaymentMethod;
      amount: number;
      actorUserId: string;
    },
  ) {
    const entry = await this.createJournal(tx, {
      organizationId: input.organizationId,
      outletId: input.outletId,
      sourceType: "receivable_payment",
      sourceId: input.paymentId,
      description: "Pembayaran piutang pelanggan",
      actorUserId: input.actorUserId,
      lines: [
        { accountCode: methodAccountCode[input.method], debit: input.amount, memo: "Kas/bank masuk" },
        { accountCode: "1100", credit: input.amount, memo: "Kurangi piutang usaha" },
      ],
    });
    await this.createCashLedger(tx, {
      organizationId: input.organizationId,
      outletId: input.outletId,
      journalEntryId: entry.id,
      sourceType: "receivable_payment",
      sourceId: input.paymentId,
      method: input.method,
      direction: "in",
      amount: input.amount,
      description: `Pembayaran piutang sale ${input.saleId}`,
      actorUserId: input.actorUserId,
    });
  },

  async createOperationalExpense(
    tx: Tx,
    input: {
      organizationId: string;
      outletId?: string | null;
      amount: number;
      method: PaymentMethod;
      vendor?: string | null;
      description: string;
      expenseDate?: Date;
      actorUserId: string;
    },
  ) {
    const accounts = await this.ensureDefaultAccounts(tx, input.organizationId);
    const expenseAccount = accounts.find((account) => account.code === "6000");
    const paidFromAccount = accounts.find((account) => account.code === methodAccountCode[input.method]);
    const [expense] = await tx
      .insert(operationalExpense)
      .values({
        organizationId: input.organizationId,
        outletId: input.outletId,
        expenseNumber: makeExpenseNumber(),
        expenseAccountId: expenseAccount?.id,
        paidFromAccountId: paidFromAccount?.id,
        method: input.method,
        amount: fixed(input.amount),
        vendor: input.vendor,
        description: input.description,
        expenseDate: input.expenseDate ?? new Date(),
        actorUserId: input.actorUserId,
      })
      .returning();

    const entry = await this.createJournal(tx, {
      organizationId: input.organizationId,
      outletId: input.outletId,
      sourceType: "operational_expense",
      sourceId: expense.id,
      description: input.description,
      actorUserId: input.actorUserId,
      entryDate: input.expenseDate,
      lines: [
        { accountCode: "6000", debit: input.amount, memo: input.description },
        { accountCode: methodAccountCode[input.method], credit: input.amount, memo: "Kas/bank keluar" },
      ],
    });
    await this.createCashLedger(tx, {
      organizationId: input.organizationId,
      outletId: input.outletId,
      journalEntryId: entry.id,
      sourceType: "operational_expense",
      sourceId: expense.id,
      method: input.method,
      direction: "out",
      amount: input.amount,
      description: input.description,
      actorUserId: input.actorUserId,
      occurredAt: input.expenseDate,
    });

    return expense;
  },

  listAccounts(organizationId: string) {
    return db
      .select()
      .from(accountingAccount)
      .where(eq(accountingAccount.organizationId, organizationId))
      .orderBy(accountingAccount.code);
  },

  listJournalEntries(organizationId: string) {
    return db
      .select()
      .from(journalEntry)
      .where(eq(journalEntry.organizationId, organizationId))
      .orderBy(desc(journalEntry.entryDate))
      .limit(200);
  },

  listCashLedger(organizationId: string) {
    return db
      .select()
      .from(cashBankLedger)
      .where(eq(cashBankLedger.organizationId, organizationId))
      .orderBy(desc(cashBankLedger.occurredAt))
      .limit(300);
  },

  listOperationalExpenses(organizationId: string) {
    return db
      .select()
      .from(operationalExpense)
      .where(eq(operationalExpense.organizationId, organizationId))
      .orderBy(desc(operationalExpense.expenseDate))
      .limit(200);
  },
};

function makeEntryNumber(sourceType: string) {
  return `JRN-${sourceType.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function makeExpenseNumber() {
  return `EXP-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function splitIncludedTax(input: { subtotal: number; serviceChargeTotal: number; taxTotal: number }) {
  const includedTax = Math.max(0, roundMoney(input.taxTotal));
  const salesTaxShare = Math.min(includedTax, Math.max(0, roundMoney(input.subtotal)));
  const serviceTaxShare = Math.min(
    Math.max(0, includedTax - salesTaxShare),
    Math.max(0, roundMoney(input.serviceChargeTotal)),
  );

  return {
    salesRevenue: roundMoney(input.subtotal - salesTaxShare),
    serviceRevenue: roundMoney(input.serviceChargeTotal - serviceTaxShare),
  };
}

function roundMoney(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}
