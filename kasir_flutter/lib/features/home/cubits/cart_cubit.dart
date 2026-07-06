import 'dart:convert';
import 'dart:math';

import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:pos_cemilan_kasir/features/home/cubits/auth_cubit.dart';
import 'package:pos_cemilan_kasir/features/home/data/pos_api.dart';
import 'package:pos_cemilan_kasir/features/home/models/pos_models.dart';
import 'package:pos_cemilan_kasir/shared/utils/api_errors.dart';

class CartPricing {
  const CartPricing({
    required this.subtotal,
    required this.manualDiscount,
    required this.tax,
    required this.serviceCharge,
    required this.donation,
    required this.promotionDiscount,
    required this.rounding,
    required this.displayDiscount,
    required this.grandTotal,
    required this.quote,
  });

  final double subtotal;
  final double manualDiscount;
  final double tax;
  final double serviceCharge;
  final double donation;
  final double promotionDiscount;
  final double rounding;
  final double displayDiscount;
  final double grandTotal;
  final SaleQuote? quote;
}

class CartState {
  const CartState({
    required this.sessions,
    required this.activeSessionId,
    required this.isQuoteLoading,
    required this.isOnline,
    required this.hasConnectivitySignal,
    required this.message,
    this.saleQuote,
    this.saleQuoteSignature,
  });

  factory CartState.initial() {
    return CartState(
      sessions: [CartSession.empty('main', 'Pelanggan 1')],
      activeSessionId: 'main',
      isQuoteLoading: false,
      isOnline: false,
      hasConnectivitySignal: false,
      message: '',
    );
  }

  final List<CartSession> sessions;
  final String activeSessionId;
  final SaleQuote? saleQuote;
  final String? saleQuoteSignature;
  final bool isQuoteLoading;
  final bool isOnline;
  final bool hasConnectivitySignal;
  final String message;

  CartSession get activeSession {
    return sessions.firstWhere(
      (session) => session.id == activeSessionId,
      orElse: () => sessions.first,
    );
  }

  List<CartLine> get cart => activeSession.lines;

  CartState copyWith({
    List<CartSession>? sessions,
    String? activeSessionId,
    SaleQuote? saleQuote,
    bool clearSaleQuote = false,
    String? saleQuoteSignature,
    bool clearSaleQuoteSignature = false,
    bool? isQuoteLoading,
    bool? isOnline,
    bool? hasConnectivitySignal,
    String? message,
  }) {
    return CartState(
      sessions: sessions ?? this.sessions,
      activeSessionId: activeSessionId ?? this.activeSessionId,
      saleQuote: clearSaleQuote ? null : (saleQuote ?? this.saleQuote),
      saleQuoteSignature: clearSaleQuoteSignature
          ? null
          : (saleQuoteSignature ?? this.saleQuoteSignature),
      isQuoteLoading: isQuoteLoading ?? this.isQuoteLoading,
      isOnline: isOnline ?? this.isOnline,
      hasConnectivitySignal:
          hasConnectivitySignal ?? this.hasConnectivitySignal,
      message: message ?? this.message,
    );
  }
}

class CartCubit extends Cubit<CartState> {
  CartCubit() : super(CartState.initial());

  List<CartLine> get cart => state.cart;

  void reset() {
    emit(CartState.initial());
  }

  void newSession() {
    final id = 'cart-${DateTime.now().microsecondsSinceEpoch}';
    final normalized = _normalizeCartCustomerLabels(state.sessions);
    emit(
      state.copyWith(
        sessions: [
          ...normalized,
          CartSession.empty(id, 'Pelanggan ${normalized.length + 1}'),
        ],
        activeSessionId: id,
        message: 'Sesi transaksi baru dibuka.',
      ),
    );
  }

  void switchSession(String id) {
    final session = state.sessions.where((item) => item.id == id).firstOrNull;
    if (session == null) {
      return;
    }
    emit(
      state.copyWith(
        activeSessionId: id,
        message: 'Berpindah ke ${session.label}.',
      ),
    );
  }

  void closeActiveSession() {
    if (state.sessions.length <= 1) {
      emit(
        state.copyWith(
          sessions: _normalizeCartCustomerLabels([
            _activeSessionWithLines(const []),
          ]),
          message: 'Keranjang dikosongkan.',
          clearSaleQuote: true,
          clearSaleQuoteSignature: true,
        ),
      );
      return;
    }
    final sessions = state.sessions
        .where((session) => session.id != state.activeSessionId)
        .toList();
    final normalized = _normalizeCartCustomerLabels(sessions);
    emit(
      state.copyWith(
        sessions: normalized,
        activeSessionId: normalized.first.id,
        message: 'Sesi transaksi ditutup.',
        clearSaleQuote: true,
        clearSaleQuoteSignature: true,
      ),
    );
  }

  bool completeActiveSession() {
    if (state.sessions.length <= 1) {
      emit(
        state.copyWith(
          sessions: _normalizeCartCustomerLabels([
            _activeSessionWithLines(const []),
          ]),
          clearSaleQuote: true,
          clearSaleQuoteSignature: true,
        ),
      );
      return true;
    }
    final sessions = state.sessions
        .where((session) => session.id != state.activeSessionId)
        .toList();
    final normalized = _normalizeCartCustomerLabels(sessions);
    emit(
      state.copyWith(
        sessions: normalized,
        activeSessionId: normalized.first.id,
        clearSaleQuote: true,
        clearSaleQuoteSignature: true,
      ),
    );
    return true;
  }

  bool addToCart(CatalogItem item) {
    final lines = List<CartLine>.from(state.cart);
    final index = lines.indexWhere((line) => line.item.skuId == item.skuId);
    final nextQuantity = index >= 0 ? lines[index].quantity + 1 : 1.0;
    final nextLine = index >= 0
        ? lines[index].copyWith(quantity: nextQuantity)
        : CartLine.fromCatalog(item: item, quantity: nextQuantity);
    if (!_isLineQuantityWithinStock(nextLine, nextQuantity)) {
      emit(
        state.copyWith(
          message: index >= 0
              ? _stockLimitMessage(nextLine)
              : _stockLimitMessageForItem(item),
        ),
      );
      return false;
    }
    if (index >= 0) {
      lines[index] = nextLine;
    } else {
      lines.add(nextLine);
    }
    _emitLines(lines, '${item.skuName} ditambahkan ke keranjang.');
    return true;
  }

  bool changeQuantity(CartLine line, double quantity) {
    final lines = List<CartLine>.from(state.cart);
    if (quantity <= 0) {
      lines.removeWhere((item) => item.item.skuId == line.item.skuId);
      _emitLines(lines, '${line.item.skuName} dihapus dari keranjang.');
      return true;
    }
    if (!_isLineQuantityWithinStock(line, quantity)) {
      emit(state.copyWith(message: _stockLimitMessage(line)));
      return false;
    }
    final index = lines.indexWhere(
      (item) => item.item.skuId == line.item.skuId,
    );
    if (index < 0) {
      return false;
    }
    lines[index] = line.copyWith(quantity: quantity);
    _emitLines(lines, 'Qty ${line.item.skuName} menjadi ${_qty(quantity)}.');
    return true;
  }

  bool changeUnit(CartLine line, UnitChoice unit) {
    final updated = line.copyWith(
      unitId: unit.id,
      unitLabel: unit.label,
      unitToBaseFactor: unit.toBaseFactor,
      unitPrice: unit.price,
    );
    if (!_isLineQuantityWithinStock(updated, updated.quantity)) {
      emit(state.copyWith(message: _stockLimitMessage(updated)));
      return false;
    }
    final lines = List<CartLine>.from(state.cart);
    final index = lines.indexWhere(
      (item) => item.item.skuId == line.item.skuId,
    );
    if (index < 0) {
      return false;
    }
    lines[index] = updated;
    _emitLines(lines, 'Satuan ${line.item.skuName} menjadi ${unit.label}.');
    return true;
  }

  bool changeLineDiscount(CartLine line, double discountTotal) {
    final lines = List<CartLine>.from(state.cart);
    final index = lines.indexWhere(
      (item) => item.item.skuId == line.item.skuId,
    );
    if (index < 0) {
      return false;
    }
    lines[index] = line.copyWith(discountTotal: max(0, discountTotal));
    _emitLines(lines, state.message);
    return true;
  }

  String? firstStockValidationMessage() {
    for (final line in state.cart) {
      if (!_isLineQuantityWithinStock(line, line.quantity)) {
        return _stockLimitMessage(line);
      }
    }
    return null;
  }

  Future<void> refreshSaleQuote({
    required PosApi api,
    required Outlet? outlet,
    required String customerId,
    required double manualDiscount,
    required double manualTax,
    required double manualServiceCharge,
    required double donation,
    required List<String> promotionCodes,
    bool showErrors = false,
  }) async {
    final signature = currentQuoteSignature(
      outlet: outlet,
      customerId: customerId,
      manualDiscount: manualDiscount,
      manualTax: manualTax,
      manualServiceCharge: manualServiceCharge,
      donation: donation,
      promotionCodes: promotionCodes,
    );
    if (outlet == null || signature == null) {
      emit(
        state.copyWith(
          clearSaleQuote: true,
          clearSaleQuoteSignature: true,
          isQuoteLoading: false,
        ),
      );
      return;
    }

    emit(state.copyWith(isQuoteLoading: true));
    try {
      final quote = await api.quoteSale(
        buildQuotePayload(
          outlet: outlet,
          customerId: customerId,
          manualDiscount: manualDiscount,
          manualTax: manualTax,
          manualServiceCharge: manualServiceCharge,
          donation: donation,
          promotionCodes: promotionCodes,
        ),
      );
      final currentSignature = currentQuoteSignature(
        outlet: outlet,
        customerId: customerId,
        manualDiscount: manualDiscount,
        manualTax: manualTax,
        manualServiceCharge: manualServiceCharge,
        donation: donation,
        promotionCodes: promotionCodes,
      );
      if (signature != currentSignature) {
        return;
      }
      emit(
        state.copyWith(
          saleQuote: quote,
          saleQuoteSignature: signature,
          isQuoteLoading: false,
          isOnline: true,
          hasConnectivitySignal: true,
        ),
      );
    } catch (error) {
      final keepCachedQuote =
          state.saleQuote != null && state.saleQuoteSignature == signature;
      emit(
        state.copyWith(
          clearSaleQuote: !keepCachedQuote,
          clearSaleQuoteSignature: !keepCachedQuote,
          isQuoteLoading: false,
          isOnline: serverReachableAfter(error),
          hasConnectivitySignal: true,
          message: showErrors
              ? 'Gagal menghitung total backend. ${readableApiError(error)}'
              : state.message,
        ),
      );
    }
  }

  CartPricing pricing({
    required Outlet? outlet,
    required String customerId,
    required double manualDiscountInput,
    required double manualTax,
    required double manualServiceCharge,
    required double donation,
    required List<String> promotionCodes,
  }) {
    final subtotal = state.cart.fold<double>(
      0,
      (sum, line) => sum + line.lineTotal,
    );
    final manualDiscount = min(manualDiscountInput, subtotal);
    final quote = currentQuote(
      outlet: outlet,
      customerId: customerId,
      manualDiscount: manualDiscount,
      manualTax: manualTax,
      manualServiceCharge: manualServiceCharge,
      donation: donation,
      promotionCodes: promotionCodes,
    );
    final localTotalBeforeRounding = max(
      0,
      subtotal - manualDiscount + manualTax + manualServiceCharge + donation,
    );
    final rounding =
        quote?.roundingTotal ??
        _roundToCashHundred(localTotalBeforeRounding) -
            localTotalBeforeRounding;
    return CartPricing(
      subtotal: subtotal,
      manualDiscount: manualDiscount,
      tax: quote?.taxTotal ?? manualTax,
      serviceCharge: quote?.serviceChargeTotal ?? manualServiceCharge,
      donation: donation,
      promotionDiscount: quote?.promotionDiscountTotal ?? 0,
      rounding: rounding,
      displayDiscount: quote?.discountTotal ?? manualDiscount,
      grandTotal:
          quote?.grandTotal ?? _roundToCashHundred(localTotalBeforeRounding),
      quote: quote,
    );
  }

  String? currentQuoteSignature({
    required Outlet? outlet,
    required String customerId,
    required double manualDiscount,
    required double manualTax,
    required double manualServiceCharge,
    required double donation,
    required List<String> promotionCodes,
  }) {
    if (outlet == null || state.cart.isEmpty) {
      return null;
    }
    return jsonEncode({
      'outletId': outlet.id,
      'customerId': customerId.trim(),
      'items': state.cart
          .map(
            (line) => {
              'skuId': line.item.skuId,
              'quantity': line.quantity,
              'unitId': line.unitId,
              'unitPrice': line.unitPrice,
              'discountTotal': line.lineDiscountTotal,
            },
          )
          .toList(),
      'discountTotal': manualDiscount,
      'taxTotal': manualTax,
      'serviceChargeTotal': manualServiceCharge,
      'donationTotal': donation,
      'promotionCodes': promotionCodes,
    });
  }

  SaleQuote? currentQuote({
    required Outlet? outlet,
    required String customerId,
    required double manualDiscount,
    required double manualTax,
    required double manualServiceCharge,
    required double donation,
    required List<String> promotionCodes,
  }) {
    final signature = currentQuoteSignature(
      outlet: outlet,
      customerId: customerId,
      manualDiscount: manualDiscount,
      manualTax: manualTax,
      manualServiceCharge: manualServiceCharge,
      donation: donation,
      promotionCodes: promotionCodes,
    );
    if (signature == null || signature != state.saleQuoteSignature) {
      return null;
    }
    return state.saleQuote;
  }

  Map<String, dynamic> buildQuotePayload({
    required Outlet outlet,
    required String customerId,
    required double manualDiscount,
    required double manualTax,
    required double manualServiceCharge,
    required double donation,
    required List<String> promotionCodes,
  }) {
    return {
      'outletId': outlet.id,
      if (customerId.trim().isNotEmpty) 'customerId': customerId.trim(),
      'items': state.cart
          .map(
            (line) => {
              'skuId': line.item.skuId,
              'quantity': line.quantity,
              'unitId': line.unitId,
              'unitPrice': line.unitPrice,
              'discountTotal': line.lineDiscountTotal,
            },
          )
          .toList(),
      'discountTotal': manualDiscount,
      'promotionCodes': promotionCodes,
      'taxTotal': manualTax,
      'serviceChargeTotal': manualServiceCharge,
      'donationTotal': donation,
    };
  }

  void _emitLines(List<CartLine> lines, String message) {
    emit(
      state.copyWith(
        sessions: _replaceActiveLines(lines),
        message: message,
        clearSaleQuote: true,
        clearSaleQuoteSignature: true,
      ),
    );
  }

  List<CartSession> _replaceActiveLines(List<CartLine> lines) {
    final sessions = List<CartSession>.from(state.sessions);
    final index = sessions.indexWhere(
      (session) => session.id == state.activeSessionId,
    );
    if (index >= 0) {
      sessions[index] = sessions[index].copyWith(lines: lines);
      return sessions;
    }
    return [
      CartSession.empty(
        state.activeSessionId,
        'Pelanggan 1',
      ).copyWith(lines: lines),
    ];
  }

  CartSession _activeSessionWithLines(List<CartLine> lines) {
    return state.activeSession.copyWith(lines: lines);
  }

  bool _isLineQuantityWithinStock(CartLine line, double quantity) {
    if (!line.item.trackInventory) {
      return true;
    }
    if (quantity <= 0) {
      return true;
    }
    return quantity * line.unitToBaseFactor <=
        line.item.availableBaseQty + 0.000001;
  }

  String _stockLimitMessage(CartLine line) {
    final availableQty = line.item.availableBaseQty / line.unitToBaseFactor;
    if (line.item.availableBaseQty <= 0 || availableQty <= 0) {
      return 'Stok ${line.item.skuName} kosong.';
    }
    return 'Qty ${line.item.skuName} melebihi stok tersedia (${_qty(availableQty)} ${line.unitLabel}).';
  }

  String _stockLimitMessageForItem(CatalogItem item) {
    final availableSaleQty =
        item.availableBaseQty /
        (item.saleUnitToBaseFactor <= 0 ? 1 : item.saleUnitToBaseFactor);
    if (item.availableBaseQty <= 0 || availableSaleQty <= 0) {
      return 'Stok ${item.skuName} kosong.';
    }
    return 'Qty ${item.skuName} melebihi stok tersedia (${_qty(availableSaleQty)} ${item.saleUnitLabel}).';
  }
}

List<CartSession> _normalizeCartCustomerLabels(List<CartSession> sessions) {
  return [
    for (var index = 0; index < sessions.length; index += 1)
      sessions[index].copyWith(label: 'Pelanggan ${index + 1}'),
  ];
}

// ApiException, ApiUnavailable, readableApiError — imported from api_errors.dart

double _roundToCashHundred(num value) {
  if (value <= 0) return 0;
  return (value / 100).ceil() * 100;
}

String _qty(num value) {
  return _formatIndonesianNumber(value, decimalDigits: value % 1 == 0 ? 0 : 3);
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

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull {
    final iterator = this.iterator;
    if (iterator.moveNext()) {
      return iterator.current;
    }
    return null;
  }
}
