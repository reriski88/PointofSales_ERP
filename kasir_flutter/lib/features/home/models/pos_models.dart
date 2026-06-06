import 'dart:convert';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:pos_cemilan_kasir/features/home/widgets/printer_settings_card.dart';

const paymentLabels = {
  'cash': 'Tunai',
  'qris': 'QRIS',
  'transfer': 'Transfer',
  'card': 'Kartu',
  'ewallet': 'E-Wallet',
  'receivable': 'Piutang',
  'other': 'Lainnya',
};

class RealtimeEvent {
  const RealtimeEvent({
    required this.id,
    required this.type,
    required this.topics,
    required this.createdAt,
    this.outletId,
    this.payload = const {},
  });

  factory RealtimeEvent.fromJson(Map<String, dynamic> json) {
    return RealtimeEvent(
      id: json['id']?.toString() ?? '',
      type: json['type']?.toString() ?? '',
      topics: ((json['topics'] as List?) ?? [])
          .map((item) => item.toString())
          .where((item) => item.isNotEmpty)
          .toList(),
      outletId: _nullableText(json['outletId']),
      payload: json['payload'] is Map
          ? Map<String, dynamic>.from(json['payload'] as Map)
          : const {},
      createdAt: _dateOrNull(json['createdAt']) ?? DateTime.now(),
    );
  }

  final String id;
  final String type;
  final List<String> topics;
  final String? outletId;
  final Map<String, dynamic> payload;
  final DateTime createdAt;
}

enum ReportRange {
  today('Hari Ini', 'Hari', Icons.today_outlined),
  week('7 Hari', '7H', Icons.calendar_view_week_outlined),
  month('30 Hari', '30H', Icons.calendar_month_outlined);

  const ReportRange(this.label, this.shortLabel, this.icon);

  final String label;
  final String shortLabel;
  final IconData icon;

  (DateTime, DateTime) period() {
    final now = DateTime.now();
    final todayStart = DateTime(now.year, now.month, now.day);
    return switch (this) {
      ReportRange.today => (
        todayStart,
        todayStart.add(const Duration(days: 1)),
      ),
      ReportRange.week => (
        todayStart.subtract(const Duration(days: 6)),
        todayStart.add(const Duration(days: 1)),
      ),
      ReportRange.month => (
        todayStart.subtract(const Duration(days: 29)),
        todayStart.add(const Duration(days: 1)),
      ),
    };
  }
}

class SalesReport {
  const SalesReport({
    required this.transactionCount,
    required this.grossSales,
    required this.netSales,
    required this.cogs,
    required this.grossProfit,
  });

  final int transactionCount;
  final double grossSales;
  final double netSales;
  final double cogs;
  final double grossProfit;

  factory SalesReport.empty() {
    return const SalesReport(
      transactionCount: 0,
      grossSales: 0,
      netSales: 0,
      cogs: 0,
      grossProfit: 0,
    );
  }

  factory SalesReport.fromJson(Map<String, dynamic> json) {
    return SalesReport(
      transactionCount: (json['transactionCount'] as num?)?.toInt() ?? 0,
      grossSales: _asDouble(json['grossSales']),
      netSales: _asDouble(json['netSales']),
      cogs: _asDouble(json['cogs']),
      grossProfit: _asDouble(json['grossProfit']),
    );
  }

  Map<String, dynamic> toJson() => {
    'transactionCount': transactionCount,
    'grossSales': grossSales,
    'netSales': netSales,
    'cogs': cogs,
    'grossProfit': grossProfit,
  };
}

class SalesDetail {
  const SalesDetail({
    required this.id,
    required this.outletLogoUrl,
    required this.receiptNumber,
    required this.status,
    required this.cashierName,
    required this.subtotal,
    required this.discountTotal,
    required this.taxTotal,
    required this.serviceChargeTotal,
    required this.donationTotal,
    required this.roundingTotal,
    required this.cashTenderedTotal,
    required this.changeTotal,
    required this.grandTotal,
    required this.grossProfit,
    required this.itemCount,
    required this.paymentMethods,
    required this.items,
    required this.payments,
    required this.createdAt,
  });

  final String id;
  final String? outletLogoUrl;
  final String receiptNumber;
  final String status;
  final String cashierName;
  final double subtotal;
  final double discountTotal;
  final double taxTotal;
  final double serviceChargeTotal;
  final double donationTotal;
  final double roundingTotal;
  final double cashTenderedTotal;
  final double changeTotal;
  final double grandTotal;
  final double grossProfit;
  final int itemCount;
  final String paymentMethods;
  final List<SalesDetailItem> items;
  final List<SalesPayment> payments;
  final DateTime createdAt;

  factory SalesDetail.fromJson(Map<String, dynamic> json) {
    return SalesDetail(
      id: json['id']?.toString() ?? '',
      outletLogoUrl: json['outletLogoUrl']?.toString(),
      receiptNumber: json['receiptNumber']?.toString() ?? '-',
      status: json['status']?.toString() ?? '-',
      cashierName: json['cashierName']?.toString() ?? '',
      subtotal: _asDouble(json['subtotal']),
      discountTotal: _asDouble(json['discountTotal']),
      taxTotal: _asDouble(json['taxTotal']),
      serviceChargeTotal: _asDouble(json['serviceChargeTotal']),
      donationTotal: _asDouble(json['donationTotal']),
      roundingTotal: _asDouble(json['roundingTotal']),
      cashTenderedTotal: _asDouble(json['cashTenderedTotal']),
      changeTotal: _asDouble(json['changeTotal']),
      grandTotal: _asDouble(json['grandTotal']),
      grossProfit: _asDouble(json['grossProfit']),
      itemCount: (json['itemCount'] as num?)?.toInt() ?? 0,
      paymentMethods: json['paymentMethods']?.toString() ?? '',
      items: ((json['items'] as List?) ?? [])
          .map(
            (item) => SalesDetailItem.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList(),
      payments: ((json['payments'] as List?) ?? [])
          .map((item) => SalesPayment.fromJson(Map<String, dynamic>.from(item)))
          .toList(),
      createdAt:
          DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
          DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'outletLogoUrl': outletLogoUrl,
    'receiptNumber': receiptNumber,
    'status': status,
    'cashierName': cashierName,
    'subtotal': subtotal,
    'discountTotal': discountTotal,
    'taxTotal': taxTotal,
    'serviceChargeTotal': serviceChargeTotal,
    'donationTotal': donationTotal,
    'roundingTotal': roundingTotal,
    'cashTenderedTotal': cashTenderedTotal,
    'changeTotal': changeTotal,
    'grandTotal': grandTotal,
    'grossProfit': grossProfit,
    'itemCount': itemCount,
    'paymentMethods': paymentMethods,
    'items': items.map((item) => item.toJson()).toList(),
    'payments': payments.map((payment) => payment.toJson()).toList(),
    'createdAt': createdAt.toIso8601String(),
  };
}

class SalesDetailItem {
  const SalesDetailItem({
    required this.name,
    required this.quantityInput,
    required this.unitCode,
    required this.unitPrice,
    required this.discountTotal,
    required this.lineTotal,
    this.trackInventory = true,
  });

  final String name;
  final double quantityInput;
  final String unitCode;
  final double unitPrice;
  final double discountTotal;
  final double lineTotal;
  final bool trackInventory;

  factory SalesDetailItem.fromJson(Map<String, dynamic> json) {
    return SalesDetailItem(
      name: json['name']?.toString() ?? '',
      quantityInput: _asDouble(json['quantityInput']),
      unitCode: json['unitCode']?.toString() ?? 'unit',
      unitPrice: _asDouble(json['unitPrice']),
      discountTotal: _asDouble(json['discountTotal']),
      lineTotal: _asDouble(json['lineTotal']),
      trackInventory: json['trackInventory'] != false,
    );
  }

  Map<String, dynamic> toJson() => {
    'name': name,
    'quantityInput': quantityInput,
    'unitCode': unitCode,
    'unitPrice': unitPrice,
    'discountTotal': discountTotal,
    'lineTotal': lineTotal,
    'trackInventory': trackInventory,
  };
}

class SalesPayment {
  const SalesPayment({required this.method, required this.amount});

  final String method;
  final double amount;

  factory SalesPayment.fromJson(Map<String, dynamic> json) {
    return SalesPayment(
      method: json['method']?.toString() ?? '-',
      amount: _asDouble(json['amount']),
    );
  }

  Map<String, dynamic> toJson() => {'method': method, 'amount': amount};
}

class Customer {
  const Customer({
    required this.id,
    required this.code,
    required this.name,
    this.phone,
    this.isActive = true,
  });

  final String id;
  final String code;
  final String name;
  final String? phone;
  final bool isActive;

  factory Customer.fromJson(Map<String, dynamic> json) {
    return Customer(
      id: json['id']?.toString() ?? '',
      code: json['code']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      phone: _nullableText(json['phone']),
      isActive: json['isActive'] != false,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'code': code,
    'name': name,
    'phone': phone,
    'isActive': isActive,
  };
}

class SaleQuote {
  const SaleQuote({
    required this.subtotal,
    required this.discountTotal,
    required this.manualDiscountTotal,
    required this.promotionDiscountTotal,
    required this.taxTotal,
    required this.serviceChargeTotal,
    required this.donationTotal,
    required this.roundingTotal,
    required this.grandTotal,
    required this.appliedPromotions,
    required this.promotionIssues,
  });

  final double subtotal;
  final double discountTotal;
  final double manualDiscountTotal;
  final double promotionDiscountTotal;
  final double taxTotal;
  final double serviceChargeTotal;
  final double donationTotal;
  final double roundingTotal;
  final double grandTotal;
  final List<AppliedPromotion> appliedPromotions;
  final List<PromotionIssue> promotionIssues;

  factory SaleQuote.fromJson(Map<String, dynamic> json) {
    return SaleQuote(
      subtotal: _asDouble(json['subtotal']),
      discountTotal: _asDouble(json['discountTotal']),
      manualDiscountTotal: _asDouble(json['manualDiscountTotal']),
      promotionDiscountTotal: _asDouble(json['promotionDiscountTotal']),
      taxTotal: _asDouble(json['taxTotal']),
      serviceChargeTotal: _asDouble(json['serviceChargeTotal']),
      donationTotal: _asDouble(json['donationTotal']),
      roundingTotal: _asDouble(json['roundingTotal']),
      grandTotal: _asDouble(json['grandTotal']),
      appliedPromotions: ((json['appliedPromotions'] as List?) ?? [])
          .map(
            (item) =>
                AppliedPromotion.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList(),
      promotionIssues: ((json['promotionIssues'] as List?) ?? [])
          .map(
            (item) => PromotionIssue.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList(),
    );
  }
}

class AppliedPromotion {
  const AppliedPromotion({
    required this.name,
    required this.discountTotal,
    this.code,
  });

  final String name;
  final String? code;
  final double discountTotal;

  factory AppliedPromotion.fromJson(Map<String, dynamic> json) {
    return AppliedPromotion(
      name: json['name']?.toString() ?? 'Promo',
      code: json['code']?.toString(),
      discountTotal: _asDouble(json['discountTotal']),
    );
  }
}

class PromotionIssue {
  const PromotionIssue({
    required this.code,
    required this.message,
    required this.reason,
  });

  final String code;
  final String message;
  final String reason;

  factory PromotionIssue.fromJson(Map<String, dynamic> json) {
    return PromotionIssue(
      code: json['code']?.toString() ?? '',
      message: json['message']?.toString() ?? 'Promo belum bisa digunakan.',
      reason: json['reason']?.toString() ?? 'unknown',
    );
  }
}

class PromotionRule {
  const PromotionRule({
    required this.id,
    required this.name,
    required this.type,
    required this.discountType,
    required this.discountValue,
    required this.scope,
    required this.outletIds,
    required this.minSubtotal,
    required this.buyQty,
    required this.getQty,
    required this.redeemedCount,
    required this.isActive,
    this.code,
    this.targetSkuId,
    this.targetCategory,
    this.maxRedemptions,
    this.startsAt,
    this.endsAt,
  });

  final String id;
  final String name;
  final String? code;
  final String type;
  final String discountType;
  final double discountValue;
  final String scope;
  final String? targetSkuId;
  final String? targetCategory;
  final List<String> outletIds;
  final double minSubtotal;
  final double buyQty;
  final double getQty;
  final int? maxRedemptions;
  final int redeemedCount;
  final DateTime? startsAt;
  final DateTime? endsAt;
  final bool isActive;

  factory PromotionRule.fromJson(Map<String, dynamic> json) {
    return PromotionRule(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Promo',
      code: _nullableText(json['code'])?.toUpperCase(),
      type: json['type']?.toString() ?? 'transaction_discount',
      discountType: json['discountType']?.toString() ?? 'amount',
      discountValue: _asDouble(json['discountValue']),
      scope: json['scope']?.toString() ?? 'all',
      targetSkuId: _nullableText(json['targetSkuId']),
      targetCategory: _nullableText(json['targetCategory']),
      outletIds: ((json['outletIds'] as List?) ?? [])
          .map((item) => item.toString())
          .where((item) => item.isNotEmpty)
          .toList(),
      minSubtotal: _asDouble(json['minSubtotal']),
      buyQty: _asDouble(json['buyQty']),
      getQty: _asDouble(json['getQty']),
      maxRedemptions: json['maxRedemptions'] == null
          ? null
          : int.tryParse(json['maxRedemptions'].toString()),
      redeemedCount: int.tryParse(json['redeemedCount']?.toString() ?? '') ?? 0,
      startsAt: _dateOrNull(json['startsAt']),
      endsAt: _dateOrNull(json['endsAt']),
      isActive: json['isActive'] != false,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'code': code,
    'type': type,
    'discountType': discountType,
    'discountValue': discountValue,
    'scope': scope,
    'targetSkuId': targetSkuId,
    'targetCategory': targetCategory,
    'outletIds': outletIds,
    'minSubtotal': minSubtotal,
    'buyQty': buyQty,
    'getQty': getQty,
    'maxRedemptions': maxRedemptions,
    'redeemedCount': redeemedCount,
    'startsAt': startsAt?.toUtc().toIso8601String(),
    'endsAt': endsAt?.toUtc().toIso8601String(),
    'isActive': isActive,
  };

  bool get hasQuota =>
      maxRedemptions == null || redeemedCount < (maxRedemptions ?? 0);

  bool isUsableNow(DateTime now) {
    if (!isActive || !hasQuota) return false;
    if (startsAt != null && startsAt!.isAfter(now)) return false;
    if (endsAt != null && endsAt!.isBefore(now)) return false;
    return true;
  }
}

class ReceiptLayout {
  const ReceiptLayout({
    required this.paperWidth,
    required this.autoPrint,
    required this.printerName,
    required this.logoUrl,
    required this.header,
    required this.body,
    required this.footer,
    required this.footerNote,
  });

  factory ReceiptLayout.defaultLayout() {
    return const ReceiptLayout(
      paperWidth: '58',
      autoPrint: false,
      printerName: 'Thermal Bluetooth RPP02N',
      logoUrl: '',
      header: ['logo', 'outlet', 'address', 'cashier', 'receiptNumber'],
      body: ['items', 'totals', 'payment'],
      footer: ['note'],
      footerNote: 'Terima kasih',
    );
  }

  factory ReceiptLayout.fromCache(String? raw) {
    if (raw == null || raw.isEmpty) {
      return ReceiptLayout.defaultLayout();
    }
    try {
      return ReceiptLayout.fromJson(Map<String, dynamic>.from(jsonDecode(raw)));
    } catch (_) {
      return ReceiptLayout.defaultLayout();
    }
  }

  factory ReceiptLayout.fromJson(Map<String, dynamic>? json) {
    final fallback = ReceiptLayout.defaultLayout();
    if (json == null) return fallback;
    List<String> blocks(String key, List<String> fallbackValue) {
      return ((json[key] as List?) ?? fallbackValue)
          .map((item) => item.toString())
          .toList();
    }

    return ReceiptLayout(
      paperWidth: json['paperWidth']?.toString() == '80' ? '80' : '58',
      autoPrint: json['autoPrint'] == true,
      printerName: json['printerName']?.toString() ?? fallback.printerName,
      logoUrl:
          json['logoUrl']?.toString() ??
          json['defaultOutletLogoUrl']?.toString() ??
          fallback.logoUrl,
      header: blocks('header', fallback.header),
      body: blocks('body', fallback.body),
      footer: blocks('footer', fallback.footer),
      footerNote: json['footerNote']?.toString() ?? fallback.footerNote,
    );
  }

  final String paperWidth;
  final bool autoPrint;
  final String printerName;
  final String logoUrl;
  final List<String> header;
  final List<String> body;
  final List<String> footer;
  final String footerNote;

  Map<String, dynamic> toJson() => {
    'paperWidth': paperWidth,
    'autoPrint': autoPrint,
    'printerName': printerName,
    'logoUrl': logoUrl,
    'header': header,
    'body': body,
    'footer': footer,
    'footerNote': footerNote,
  };
}

class ReceiptLine {
  const ReceiptLine({
    required this.name,
    required this.quantity,
    required this.unitLabel,
    required this.unitPrice,
    required this.lineTotal,
    this.discountTotal = 0,
    this.trackInventory = true,
  });

  final String name;
  final double quantity;
  final String unitLabel;
  final double unitPrice;
  final double lineTotal;
  final double discountTotal;
  final bool trackInventory;
}

class ReceiptPayment {
  const ReceiptPayment({required this.method, required this.amount});

  final String method;
  final double amount;

  String get label => paymentLabels[method] ?? method;
}

class ReceiptData {
  const ReceiptData({
    required this.receiptNumber,
    required this.outletName,
    required this.outletAddress,
    required this.cashierName,
    required this.createdAt,
    required this.lines,
    required this.subtotal,
    required this.discount,
    required this.tax,
    required this.serviceCharge,
    required this.donation,
    required this.rounding,
    required this.grandTotal,
    required this.payments,
    required this.cashTenderedTotal,
    required this.changeTotal,
    this.logoUrl,
    this.receivableAmount = 0,
  });

  factory ReceiptData.fromCart({
    required String receiptNumber,
    required String outletName,
    required String outletAddress,
    required String cashierName,
    required DateTime createdAt,
    required List<CartLine> lines,
    required double subtotal,
    required double discount,
    required double tax,
    required double serviceCharge,
    required double donation,
    required double rounding,
    required double grandTotal,
    required List<SalesPayment> payments,
    required double cashTenderedTotal,
    required double changeTotal,
    String? logoUrl,
    double receivableAmount = 0,
  }) {
    return ReceiptData(
      receiptNumber: receiptNumber,
      outletName: outletName,
      outletAddress: outletAddress,
      cashierName: cashierName,
      createdAt: createdAt,
      logoUrl: logoUrl,
      lines: lines
          .map(
            (line) => ReceiptLine(
              name: line.item.skuName,
              quantity: line.quantity,
              unitLabel: line.unitLabel,
              trackInventory: line.item.trackInventory,
              unitPrice: line.unitPrice,
              lineTotal: line.lineTotal,
              discountTotal: line.lineDiscountTotal,
            ),
          )
          .toList(),
      subtotal: subtotal,
      discount: discount,
      tax: tax,
      serviceCharge: serviceCharge,
      donation: donation,
      rounding: rounding,
      grandTotal: grandTotal,
      payments: payments
          .map(
            (payment) =>
                ReceiptPayment(method: payment.method, amount: payment.amount),
          )
          .toList(),
      cashTenderedTotal: cashTenderedTotal,
      changeTotal: changeTotal,
      receivableAmount: receivableAmount,
    );
  }

  factory ReceiptData.fromSalesDetail(
    SalesDetail detail, {
    required String outletName,
    String outletAddress = '',
  }) {
    return ReceiptData(
      receiptNumber: detail.receiptNumber,
      outletName: outletName,
      outletAddress: outletAddress,
      cashierName: detail.cashierName,
      createdAt: detail.createdAt,
      logoUrl: detail.outletLogoUrl,
      lines: detail.items
          .map(
            (line) => ReceiptLine(
              name: line.name,
              quantity: line.quantityInput,
              unitLabel: line.unitCode,
              trackInventory: line.trackInventory,
              unitPrice: line.unitPrice,
              lineTotal: line.lineTotal,
              discountTotal: line.discountTotal,
            ),
          )
          .toList(),
      subtotal: detail.subtotal,
      discount: detail.discountTotal,
      tax: detail.taxTotal,
      serviceCharge: detail.serviceChargeTotal,
      donation: detail.donationTotal,
      rounding: detail.roundingTotal,
      grandTotal: detail.grandTotal,
      payments: detail.payments
          .map(
            (payment) =>
                ReceiptPayment(method: payment.method, amount: payment.amount),
          )
          .toList(),
      cashTenderedTotal: detail.cashTenderedTotal,
      changeTotal: detail.changeTotal,
    );
  }

  factory ReceiptData.sample() {
    return ReceiptData(
      receiptNumber: 'TEST-PRINT',
      outletName: 'Smart POS ERP',
      outletAddress: '',
      cashierName: 'Kasir',
      createdAt: DateTime.now(),
      logoUrl: null,
      lines: const [
        ReceiptLine(
          name: 'Contoh Produk',
          quantity: 1,
          unitLabel: 'pcs',
          unitPrice: 10000,
          lineTotal: 10000,
        ),
      ],
      subtotal: 10000,
      discount: 0,
      tax: 0,
      serviceCharge: 0,
      donation: 0,
      rounding: 0,
      grandTotal: 10000,
      payments: const [ReceiptPayment(method: 'cash', amount: 10000)],
      cashTenderedTotal: 10000,
      changeTotal: 0,
    );
  }

  final String receiptNumber;
  final String outletName;
  final String outletAddress;
  final String cashierName;
  final DateTime createdAt;
  final String? logoUrl;
  final List<ReceiptLine> lines;
  final double subtotal;
  final double discount;
  final double tax;
  final double serviceCharge;
  final double donation;
  final double rounding;
  final double grandTotal;
  final List<ReceiptPayment> payments;
  final double cashTenderedTotal;
  final double changeTotal;
  final double receivableAmount;
}

class BluetoothPrinterDevice extends PrinterDeviceViewModel {
  const BluetoothPrinterDevice({
    required super.name,
    required super.address,
    required this.type,
  });

  factory BluetoothPrinterDevice.fromMap(Map<dynamic, dynamic> map) {
    return BluetoothPrinterDevice(
      name: map['name']?.toString() ?? '',
      address: map['address']?.toString() ?? '',
      type: map['type']?.toString() ?? 'unknown',
    );
  }

  final String type;
}

class CurrentUser {
  const CurrentUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
  });

  final String id;
  final String name;
  final String email;
  final String role;

  factory CurrentUser.fromJson(Map<String, dynamic> json) {
    return CurrentUser(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      role: json['role']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'email': email,
    'role': role,
  };
}

class Outlet {
  const Outlet({
    required this.id,
    required this.name,
    required this.code,
    this.address = '',
    this.logoUrl,
    this.isActive = true,
  });

  final String id;
  final String name;
  final String code;
  final String address;
  final String? logoUrl;
  final bool isActive;

  factory Outlet.fromJson(Map<String, dynamic> json) {
    return Outlet(
      id: json['id'].toString(),
      name: json['name']?.toString() ?? '',
      code: json['code']?.toString() ?? '',
      address: json['address']?.toString() ?? '',
      logoUrl: json['logoUrl']?.toString(),
      isActive: json['isActive'] != false,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'code': code,
    'logoUrl': logoUrl,
    'isActive': isActive,
  };
}

class CatalogItem {
  const CatalogItem({
    required this.productId,
    required this.productName,
    required this.skuId,
    required this.skuCode,
    required this.skuName,
    required this.price,
    required this.saleUnitId,
    required this.saleUnitToBaseFactor,
    this.category,
    this.productImageUrl,
    this.skuImageUrl,
    this.barcode,
    this.baseUnitId,
    this.baseUnitCode,
    this.trackInventory = true,
    this.quantityMode = 'required',
    this.onHandBaseQty = 0,
    this.reservedBaseQty = 0,
    this.holdBaseQty = 0,
  });

  final String productId;
  final String productName;
  final String skuId;
  final String skuCode;
  final String skuName;
  final double price;
  final String saleUnitId;
  final double saleUnitToBaseFactor;
  final String? category;
  final String? productImageUrl;
  final String? skuImageUrl;
  final String? barcode;
  final String? baseUnitId;
  final String? baseUnitCode;
  final bool trackInventory;
  final String quantityMode;
  final double onHandBaseQty;
  final double reservedBaseQty;
  final double holdBaseQty;

  double get availableBaseQty => trackInventory
      ? max(0, onHandBaseQty - reservedBaseQty - holdBaseQty)
      : double.infinity;
  double get saleUnitPrice => price;
  double get baseUnitPrice {
    final factor = saleUnitToBaseFactor <= 0 ? 1 : saleUnitToBaseFactor;
    return price / factor;
  }

  String get saleUnitLabel {
    if (saleUnitToBaseFactor == 1) {
      return baseUnitCode ?? 'unit';
    }
    return '${_qty(saleUnitToBaseFactor)} ${baseUnitCode ?? 'unit'}';
  }

  List<UnitChoice> get unitChoices {
    final choices = <UnitChoice>[
      UnitChoice(
        id: saleUnitId,
        label: saleUnitLabel,
        toBaseFactor: saleUnitToBaseFactor <= 0 ? 1 : saleUnitToBaseFactor,
        price: saleUnitPrice,
      ),
    ];
    if (baseUnitId != null &&
        baseUnitId!.isNotEmpty &&
        baseUnitId != saleUnitId) {
      choices.add(
        UnitChoice(
          id: baseUnitId!,
          label: baseUnitCode ?? 'unit',
          toBaseFactor: 1,
          price: baseUnitPrice,
        ),
      );
    }
    return choices;
  }

  CatalogItem copyWith({
    double? onHandBaseQty,
    double? reservedBaseQty,
    double? holdBaseQty,
  }) {
    return CatalogItem(
      productId: productId,
      productName: productName,
      skuId: skuId,
      skuCode: skuCode,
      skuName: skuName,
      price: price,
      saleUnitId: saleUnitId,
      saleUnitToBaseFactor: saleUnitToBaseFactor,
      category: category,
      productImageUrl: productImageUrl,
      skuImageUrl: skuImageUrl,
      barcode: barcode,
      baseUnitId: baseUnitId,
      baseUnitCode: baseUnitCode,
      trackInventory: trackInventory,
      quantityMode: quantityMode,
      onHandBaseQty: onHandBaseQty ?? this.onHandBaseQty,
      reservedBaseQty: reservedBaseQty ?? this.reservedBaseQty,
      holdBaseQty: holdBaseQty ?? this.holdBaseQty,
    );
  }

  factory CatalogItem.fromJson(Map<String, dynamic> json) {
    return CatalogItem(
      productId:
          json['productId']?.toString() ?? json['product_id']?.toString() ?? '',
      productName:
          json['productName']?.toString() ??
          json['product_name']?.toString() ??
          '',
      category: json['category']?.toString(),
      productImageUrl: json['productImageUrl']?.toString(),
      skuImageUrl:
          json['skuImageUrl']?.toString() ?? json['imageUrl']?.toString(),
      skuId: json['skuId']?.toString() ?? json['sku_id']?.toString() ?? '',
      skuCode: json['skuCode']?.toString() ?? json['sku']?.toString() ?? '',
      barcode: json['barcode']?.toString(),
      skuName: json['skuName']?.toString() ?? json['name']?.toString() ?? '',
      price: _asDouble(json['price']),
      baseUnitId: json['baseUnitId']?.toString(),
      saleUnitId: json['saleUnitId']?.toString() ?? '',
      saleUnitToBaseFactor: _asDouble(
        json['saleUnitToBaseFactor'],
        fallback: 1,
      ),
      baseUnitCode: json['baseUnitCode']?.toString(),
      trackInventory: json['trackInventory'] != false,
      quantityMode: json['quantityMode']?.toString() == 'fixed_one'
          ? 'fixed_one'
          : 'required',
      onHandBaseQty: _asDouble(json['onHandBaseQty']),
      reservedBaseQty: _asDouble(json['reservedBaseQty']),
      holdBaseQty: _asDouble(json['holdBaseQty']),
    );
  }

  Map<String, dynamic> toJson() => {
    'productId': productId,
    'productName': productName,
    'category': category,
    'productImageUrl': productImageUrl,
    'skuImageUrl': skuImageUrl,
    'skuId': skuId,
    'skuCode': skuCode,
    'barcode': barcode,
    'skuName': skuName,
    'price': price,
    'baseUnitId': baseUnitId,
    'saleUnitId': saleUnitId,
    'saleUnitToBaseFactor': saleUnitToBaseFactor,
    'baseUnitCode': baseUnitCode,
    'trackInventory': trackInventory,
    'quantityMode': quantityMode,
    'onHandBaseQty': onHandBaseQty,
    'reservedBaseQty': reservedBaseQty,
    'holdBaseQty': holdBaseQty,
  };
}

class UnitChoice {
  const UnitChoice({
    required this.id,
    required this.label,
    required this.toBaseFactor,
    required this.price,
  });

  final String id;
  final String label;
  final double toBaseFactor;
  final double price;
}

class Shift {
  const Shift({
    required this.id,
    required this.status,
    required this.expectedCash,
    required this.openingCash,
    this.cashInTotal = 0,
    this.cashOutTotal = 0,
    this.actualCash,
    this.cashVariance,
    this.closeApprovalStatus,
  });

  final String id;
  final String status;
  final double expectedCash;
  final double openingCash;
  final double cashInTotal;
  final double cashOutTotal;
  final double? actualCash;
  final double? cashVariance;
  final String? closeApprovalStatus;

  factory Shift.fromJson(Map<String, dynamic> json) {
    return Shift(
      id: json['id'].toString(),
      status: json['status']?.toString() ?? 'open',
      expectedCash: _asDouble(json['expectedCash']),
      openingCash: _asDouble(json['openingCash']),
      cashInTotal: _asDouble(json['cashInTotal']),
      cashOutTotal: _asDouble(json['cashOutTotal']),
      actualCash: json['actualCash'] == null
          ? null
          : _asDouble(json['actualCash']),
      cashVariance: json['cashVariance'] == null
          ? null
          : _asDouble(json['cashVariance']),
      closeApprovalStatus: json['closeApprovalStatus']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'status': status,
    'expectedCash': expectedCash,
    'openingCash': openingCash,
    'cashInTotal': cashInTotal,
    'cashOutTotal': cashOutTotal,
    'actualCash': actualCash,
    'cashVariance': cashVariance,
    'closeApprovalStatus': closeApprovalStatus,
  };
}

class ShiftCashMovement {
  const ShiftCashMovement({
    required this.id,
    required this.type,
    required this.amount,
    required this.reason,
    required this.createdAt,
    this.note,
    this.actorName,
  });

  final String id;
  final String type;
  final double amount;
  final String reason;
  final String? note;
  final String? actorName;
  final DateTime createdAt;

  factory ShiftCashMovement.fromJson(Map<String, dynamic> json) {
    return ShiftCashMovement(
      id: json['id']?.toString() ?? '',
      type: json['type']?.toString() ?? 'cash_in',
      amount: _asDouble(json['amount']),
      reason: json['reason']?.toString() ?? '',
      note: _nullableText(json['note']),
      actorName: _nullableText(json['actorName']),
      createdAt:
          DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
          DateTime.now(),
    );
  }
}

class ShiftPaymentSummary {
  const ShiftPaymentSummary({
    required this.method,
    required this.amount,
    required this.count,
  });

  final String method;
  final double amount;
  final int count;

  factory ShiftPaymentSummary.fromJson(Map<String, dynamic> json) {
    return ShiftPaymentSummary(
      method: json['method']?.toString() ?? '-',
      amount: _asDouble(json['amount']),
      count: int.tryParse(json['count']?.toString() ?? '') ?? 0,
    );
  }
}

class ShiftSummary {
  const ShiftSummary({
    required this.shift,
    required this.cashMovements,
    required this.paymentSummary,
    this.variance,
  });

  final Shift shift;
  final List<ShiftCashMovement> cashMovements;
  final List<ShiftPaymentSummary> paymentSummary;
  final double? variance;

  factory ShiftSummary.fromJson(Map<String, dynamic> json) {
    return ShiftSummary(
      shift: Shift.fromJson(Map<String, dynamic>.from(json['shift'] as Map)),
      cashMovements: ((json['cashMovements'] as List?) ?? [])
          .map(
            (item) =>
                ShiftCashMovement.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList(),
      paymentSummary: ((json['paymentSummary'] as List?) ?? [])
          .map(
            (item) =>
                ShiftPaymentSummary.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList(),
      variance: json['variance'] == null ? null : _asDouble(json['variance']),
    );
  }
}

class PendingVarianceShift {
  const PendingVarianceShift({
    required this.id,
    required this.cashierName,
    required this.expectedCash,
    required this.actualCash,
    required this.cashVariance,
    this.varianceReason,
    this.closedAt,
  });

  final String id;
  final String cashierName;
  final double expectedCash;
  final double actualCash;
  final double cashVariance;
  final String? varianceReason;
  final DateTime? closedAt;

  factory PendingVarianceShift.fromJson(Map<String, dynamic> json) {
    return PendingVarianceShift(
      id: json['id']?.toString() ?? '',
      cashierName: json['cashierName']?.toString() ?? 'Kasir',
      expectedCash: _asDouble(json['expectedCash']),
      actualCash: _asDouble(json['actualCash']),
      cashVariance: _asDouble(json['cashVariance']),
      varianceReason: _nullableText(json['varianceReason']),
      closedAt: _dateOrNull(json['closedAt']),
    );
  }
}

class CartSession {
  const CartSession({
    required this.id,
    required this.label,
    required this.lines,
  });

  factory CartSession.empty(String id, String label) {
    return CartSession(id: id, label: label, lines: []);
  }

  final String id;
  final String label;
  final List<CartLine> lines;

  CartSession copyWith({String? label, List<CartLine>? lines}) {
    return CartSession(
      id: id,
      label: label ?? this.label,
      lines: lines ?? this.lines,
    );
  }
}

class CartLine {
  const CartLine({
    required this.item,
    required this.quantity,
    required this.unitId,
    required this.unitLabel,
    required this.unitToBaseFactor,
    required this.unitPrice,
    this.discountTotal = 0,
  });

  factory CartLine.fromCatalog({
    required CatalogItem item,
    required double quantity,
  }) {
    final unit = item.unitChoices.first;
    return CartLine(
      item: item,
      quantity: quantity,
      unitId: unit.id,
      unitLabel: unit.label,
      unitToBaseFactor: unit.toBaseFactor,
      unitPrice: unit.price,
      discountTotal: 0,
    );
  }

  final CatalogItem item;
  final double quantity;
  final String unitId;
  final String unitLabel;
  final double unitToBaseFactor;
  final double unitPrice;
  final double discountTotal;

  double get grossTotal => unitPrice * quantity;
  double get lineDiscountTotal => min(discountTotal, grossTotal);
  double get lineTotal => max(0, grossTotal - lineDiscountTotal);

  CartLine copyWith({
    double? quantity,
    String? unitId,
    String? unitLabel,
    double? unitToBaseFactor,
    double? unitPrice,
    double? discountTotal,
  }) {
    return CartLine(
      item: item,
      quantity: quantity ?? this.quantity,
      unitId: unitId ?? this.unitId,
      unitLabel: unitLabel ?? this.unitLabel,
      unitToBaseFactor: unitToBaseFactor ?? this.unitToBaseFactor,
      unitPrice: unitPrice ?? this.unitPrice,
      discountTotal: discountTotal ?? this.discountTotal,
    );
  }
}

String _qty(num value) {
  return _formatIndonesianNumber(value, decimalDigits: value % 1 == 0 ? 0 : 3);
}

double _asDouble(dynamic value, {double fallback = 0}) {
  if (value == null) {
    return fallback;
  }
  if (value is num) {
    return value.toDouble();
  }
  return double.tryParse(value.toString()) ?? fallback;
}

String? _nullableText(dynamic value) {
  final text = value?.toString().trim();
  return text == null || text.isEmpty ? null : text;
}

DateTime? _dateOrNull(dynamic value) {
  final text = value?.toString();
  if (text == null || text.isEmpty) {
    return null;
  }
  return DateTime.tryParse(text);
}

String _formatIndonesianNumber(num value, {required int decimalDigits}) {
  final isNegative = value < 0;
  final fixed = value.abs().toStringAsFixed(decimalDigits);
  final parts = fixed.split('.');
  final whole = parts[0].replaceAllMapped(
    RegExp(r'\B(?=(\d{3})+(?!\d))'),
    (_) => '.',
  );
  var decimal = parts.length > 1 ? parts[1] : '';
  decimal = decimal.replaceFirst(RegExp(r'0+$'), '');
  final sign = isNegative ? '-' : '';
  if (decimal.isEmpty) {
    return '$sign$whole';
  }
  return '$sign$whole,$decimal';
}
