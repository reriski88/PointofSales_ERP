import 'dart:convert';
import 'dart:math';

import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:pos_cemilan_kasir/features/home/cubits/auth_cubit.dart';
import 'package:pos_cemilan_kasir/features/home/data/pos_api.dart';
import 'package:pos_cemilan_kasir/features/home/models/pos_models.dart';
import 'package:pos_cemilan_kasir/shared/utils/api_errors.dart';
import 'package:shared_preferences/shared_preferences.dart';

class CheckoutState {
  const CheckoutState({
    required this.pendingSales,
    required this.pendingWastes,
    required this.isBusy,
    required this.isOnline,
    required this.message,
    required this.hasShiftSyncFailure,
  });

  factory CheckoutState.initial() {
    return const CheckoutState(
      pendingSales: [],
      pendingWastes: [],
      isBusy: false,
      isOnline: false,
      message: '',
      hasShiftSyncFailure: false,
    );
  }

  final List<Map<String, dynamic>> pendingSales;
  final List<Map<String, dynamic>> pendingWastes;
  final bool isBusy;
  final bool isOnline;
  final String message;
  final bool hasShiftSyncFailure;

  CheckoutState copyWith({
    List<Map<String, dynamic>>? pendingSales,
    List<Map<String, dynamic>>? pendingWastes,
    bool? isBusy,
    bool? isOnline,
    String? message,
    bool? hasShiftSyncFailure,
  }) {
    return CheckoutState(
      pendingSales: pendingSales ?? this.pendingSales,
      pendingWastes: pendingWastes ?? this.pendingWastes,
      isBusy: isBusy ?? this.isBusy,
      isOnline: isOnline ?? this.isOnline,
      message: message ?? this.message,
      hasShiftSyncFailure: hasShiftSyncFailure ?? this.hasShiftSyncFailure,
    );
  }
}

class CheckoutResult {
  const CheckoutResult({
    required this.receiptData,
    required this.isOnline,
    required this.message,
    required this.toast,
  });

  final ReceiptData receiptData;
  final bool isOnline;
  final String message;
  final String toast;
}

class CheckoutCubit extends Cubit<CheckoutState> {
  CheckoutCubit() : super(CheckoutState.initial());

  static const pendingKey = 'pending_sales';
  static const pendingWastesKey = 'pending_wastes';

  void restorePending(SharedPreferences prefs) {
    emit(
      state.copyWith(
        pendingSales: _decodeList(prefs.getString(pendingKey)),
        pendingWastes: _decodeList(prefs.getString(pendingWastesKey)),
      ),
    );
  }

  Future<CheckoutResult?> checkout({
    required PosApi api,
    required SharedPreferences? prefs,
    required Outlet? outlet,
    required Shift? shift,
    required String cashierName,
    required String? logoUrl,
    required List<CartLine> lines,
    required List<SalesPayment> payments,
    required double subtotal,
    required double discount,
    required double manualDiscount,
    required double tax,
    required double manualTax,
    required double serviceCharge,
    required double manualServiceCharge,
    required double donation,
    required double rounding,
    required double grandTotal,
    required double cashTenderedTotal,
    required double changeTotal,
    required String customerId,
    required bool hasReceivablePayment,
    required double receivableAmount,
    required double nonCashOverpaid,
    required List<String> promotionCodes,
    required String? stockMessage,
    required bool hasEmptySplitAmount,
  }) async {
    final validationMessage = _validateCheckout(
      outlet: outlet,
      shift: shift,
      lines: lines,
      payments: payments,
      grandTotal: grandTotal,
      customerId: customerId,
      hasReceivablePayment: hasReceivablePayment,
      nonCashOverpaid: nonCashOverpaid,
      stockMessage: stockMessage,
      hasEmptySplitAmount: hasEmptySplitAmount,
    );
    if (validationMessage != null) {
      emit(state.copyWith(message: validationMessage));
      return null;
    }

    final payload = _buildSalePayload(
      outlet: outlet!,
      shift: shift!,
      lines: lines,
      payments: payments,
      cashTenderedTotal: cashTenderedTotal,
      customerId: customerId,
      allowReceivable: hasReceivablePayment && receivableAmount > 0,
      discount: manualDiscount,
      promotionCodes: promotionCodes,
      manualTax: manualTax,
      manualServiceCharge: manualServiceCharge,
      donation: donation,
    );
    final localReceiptData = ReceiptData.fromCart(
      receiptNumber: payload['receiptNumber']?.toString() ?? '-',
      outletName: outlet.name,
      outletAddress: outlet.address,
      cashierName: cashierName,
      createdAt: DateTime.now(),
      lines: List<CartLine>.from(lines),
      logoUrl: logoUrl,
      subtotal: subtotal,
      discount: discount,
      tax: tax,
      serviceCharge: serviceCharge,
      donation: donation,
      rounding: rounding,
      grandTotal: grandTotal,
      payments: payments,
      cashTenderedTotal: cashTenderedTotal,
      changeTotal: changeTotal,
      receivableAmount: receivableAmount,
    );

    emit(state.copyWith(isBusy: true, message: ''));
    try {
      final saleResult = await api.createSale(payload);
      final serverSale = saleResult['sale'];
      final receiptData = serverSale is Map
          ? ReceiptData.fromCart(
              receiptNumber:
                  serverSale['receiptNumber']?.toString() ??
                  payload['receiptNumber']?.toString() ??
                  '-',
              outletName: outlet.name,
              outletAddress: outlet.address,
              cashierName: cashierName,
              createdAt: DateTime.now(),
              lines: List<CartLine>.from(lines),
              logoUrl: logoUrl,
              subtotal: _asDouble(serverSale['subtotal'], fallback: subtotal),
              discount: _asDouble(
                serverSale['discountTotal'],
                fallback: discount,
              ),
              tax: _asDouble(serverSale['taxTotal'], fallback: tax),
              serviceCharge: _asDouble(
                serverSale['serviceChargeTotal'],
                fallback: serviceCharge,
              ),
              donation: _asDouble(
                serverSale['donationTotal'],
                fallback: donation,
              ),
              rounding: _asDouble(
                serverSale['roundingTotal'],
                fallback: rounding,
              ),
              grandTotal: _asDouble(
                serverSale['grandTotal'],
                fallback: grandTotal,
              ),
              payments: payments,
              cashTenderedTotal: _asDouble(
                serverSale['cashTenderedTotal'],
                fallback: cashTenderedTotal,
              ),
              changeTotal: _asDouble(
                serverSale['changeTotal'],
                fallback: changeTotal,
              ),
              receivableAmount: receivableAmount,
            )
          : localReceiptData;
      final message =
          'Transaksi online tersimpan dan tampil di web: ${receiptData.receiptNumber}.';
      emit(state.copyWith(isOnline: true, message: message));
      return CheckoutResult(
        receiptData: receiptData,
        isOnline: true,
        message: message,
        toast: 'Transaksi online tersimpan: ${receiptData.receiptNumber}',
      );
    } on ApiException catch (error) {
      emit(
        state.copyWith(
          isOnline: true,
          message: 'Transaksi gagal. ${readableApiError(error)}',
        ),
      );
      return null;
    } catch (_) {
      final pendingSales = [...state.pendingSales, payload];
      await _savePendingSales(prefs, pendingSales);
      const message =
          'Transaksi masuk antrean offline dan belum tampil di web sampai sync berhasil.';
      emit(
        state.copyWith(
          pendingSales: pendingSales,
          isOnline: false,
          message: message,
        ),
      );
      return CheckoutResult(
        receiptData: localReceiptData,
        isOnline: false,
        message: message,
        toast: 'Transaksi belum masuk web. Tersimpan di antrean offline.',
      );
    } finally {
      emit(state.copyWith(isBusy: false));
    }
  }

  Future<void> syncPending({
    required PosApi api,
    required SharedPreferences? prefs,
  }) async {
    if (state.pendingSales.isEmpty && state.pendingWastes.isEmpty) {
      emit(state.copyWith(message: 'Tidak ada antrean sync.'));
      return;
    }
    emit(state.copyWith(isBusy: true, message: '', hasShiftSyncFailure: false));
    try {
      final byOutlet = <String, List<Map<String, dynamic>>>{};
      for (final sale in state.pendingSales) {
        final outletId = sale['outletId']?.toString();
        if (outletId == null || outletId.isEmpty) {
          continue;
        }
        byOutlet.putIfAbsent(outletId, () => []).add(sale);
      }

      final completedKeys = <String>{};
      final reviewKeys = <String>{};
      var conflictCount = 0;
      var failedCount = 0;
      var shiftFailureCount = 0;
      for (final entry in byOutlet.entries) {
        final results = await api.pushSync(entry.key, entry.value);
        for (final result in results) {
          final key = result['idempotencyKey']?.toString();
          final status = result['status']?.toString();
          final error = result['error']?.toString() ?? '';
          if (key != null && status == 'processed') {
            completedKeys.add(key);
          }
          if (key != null && status == 'conflict') {
            reviewKeys.add(key);
          }
          if (status == 'conflict') conflictCount += 1;
          if (status == 'failed') {
            failedCount += 1;
            if (_isShiftSyncFailure(error)) {
              shiftFailureCount += 1;
            }
          }
        }
      }

      final pendingSales = state.pendingSales
          .where(
            (sale) =>
                !completedKeys.contains(sale['idempotencyKey']?.toString()) &&
                !reviewKeys.contains(sale['idempotencyKey']?.toString()),
          )
          .toList();
      await _savePendingSales(prefs, pendingSales);

      final completedWasteKeys = <String>{};
      var failedWasteCount = 0;
      for (final waste in state.pendingWastes) {
        final key = waste['idempotencyKey']?.toString() ?? '';
        try {
          await api.createWasteAdjustment(
            outletId: waste['outletId']?.toString() ?? '',
            skuId: waste['skuId']?.toString() ?? '',
            quantity: _asDouble(waste['quantity']),
            unitId: waste['unitId']?.toString() ?? '',
            reason: waste['reason']?.toString() ?? 'other',
            idempotencyKey: key,
            note: waste['note']?.toString(),
          );
          if (key.isNotEmpty) {
            completedWasteKeys.add(key);
          }
        } on ApiUnavailable {
          rethrow;
        } catch (_) {
          failedWasteCount += 1;
        }
      }
      final pendingWastes = state.pendingWastes
          .where(
            (waste) => !completedWasteKeys.contains(
              waste['idempotencyKey']?.toString(),
            ),
          )
          .toList();
      await _savePendingWastes(prefs, pendingWastes);

      final message = [
        if (completedKeys.isNotEmpty)
          '${completedKeys.length} transaksi tersinkron',
        if (completedWasteKeys.isNotEmpty)
          '${completedWasteKeys.length} remahan tersinkron',
        if (conflictCount > 0) '$conflictCount konflik stok belum diposting',
        if (reviewKeys.isNotEmpty) 'Cek menu laporan web: status Perlu review',
        if (shiftFailureCount > 0)
          '$shiftFailureCount transaksi gagal karena shift lokal sudah tidak aktif. Buka shift baru, lalu coba sync lagi',
        if (failedCount - shiftFailureCount > 0)
          '${failedCount - shiftFailureCount} transaksi gagal sync',
        if (failedWasteCount > 0) '$failedWasteCount remahan gagal sync',
        if (completedKeys.isEmpty &&
            completedWasteKeys.isEmpty &&
            conflictCount == 0 &&
            failedCount == 0 &&
            failedWasteCount == 0)
          'Sync belum memproses transaksi',
      ].join('. ');
      emit(
        state.copyWith(
          pendingSales: pendingSales,
          pendingWastes: pendingWastes,
          isOnline: true,
          message: message,
          hasShiftSyncFailure: shiftFailureCount > 0,
        ),
      );
    } catch (error) {
      emit(
        state.copyWith(
          isOnline: serverReachableAfter(error),
          message: 'Sync gagal. ${readableApiError(error)}',
        ),
      );
    } finally {
      emit(state.copyWith(isBusy: false));
    }
  }

  Future<bool> recordWaste({
    required PosApi api,
    required SharedPreferences? prefs,
    required String outletId,
    required String skuId,
    required double quantity,
    required String unitId,
    required String reason,
    String? note,
  }) async {
    emit(state.copyWith(isBusy: true, message: ''));
    try {
      await api.createWasteAdjustment(
        outletId: outletId,
        skuId: skuId,
        quantity: quantity,
        unitId: unitId,
        reason: reason,
        note: note,
      );
      emit(
        state.copyWith(
          isOnline: true,
          message: 'Remahan dicatat dan stok tersedia diperbarui.',
        ),
      );
      return true;
    } on ApiException catch (error) {
      emit(
        state.copyWith(
          isOnline: true,
          message: 'Input remahan gagal. ${readableApiError(error)}',
        ),
      );
      return false;
    } catch (_) {
      final now = DateTime.now();
      final payload = {
        'outletId': outletId,
        'skuId': skuId,
        'quantity': quantity,
        'unitId': unitId,
        'reason': reason,
        if (note != null && note.isNotEmpty) 'note': note,
        'idempotencyKey':
            'waste-${now.microsecondsSinceEpoch}-${Random().nextInt(999999)}',
        'clientCreatedAt': now.toUtc().toIso8601String(),
      };
      final pendingWastes = [...state.pendingWastes, payload];
      await _savePendingWastes(prefs, pendingWastes);
      emit(
        state.copyWith(
          pendingWastes: pendingWastes,
          isOnline: false,
          message: 'Remahan masuk antrean offline dan akan sync saat online.',
        ),
      );
      return true;
    } finally {
      emit(state.copyWith(isBusy: false));
    }
  }

  String? _validateCheckout({
    required Outlet? outlet,
    required Shift? shift,
    required List<CartLine> lines,
    required List<SalesPayment> payments,
    required double grandTotal,
    required String customerId,
    required bool hasReceivablePayment,
    required double nonCashOverpaid,
    required String? stockMessage,
    required bool hasEmptySplitAmount,
  }) {
    if (outlet == null) {
      return 'Pilih outlet terlebih dahulu.';
    }
    if (shift == null) {
      return 'Buka shift sebelum transaksi.';
    }
    if (lines.isEmpty) {
      return 'Keranjang masih kosong.';
    }
    if (stockMessage != null) {
      return stockMessage;
    }
    if (hasEmptySplitAmount) {
      return 'Nominal setiap pembayaran split wajib lebih dari 0.';
    }
    if (hasReceivablePayment && customerId.trim().isEmpty) {
      return 'Pilih pelanggan terlebih dahulu untuk transaksi piutang.';
    }
    if (payments.isEmpty && !hasReceivablePayment) {
      return 'Tambahkan minimal satu pembayaran.';
    }
    if (nonCashOverpaid > 0) {
      return 'Pembayaran non-tunai berlebih. Kembalian hanya berlaku untuk tunai.';
    }
    final paidTotal = payments.fold<double>(
      0,
      (sum, item) => sum + item.amount,
    );
    if (!hasReceivablePayment && paidTotal + 0.000001 < grandTotal) {
      return 'Total pembayaran masih kurang.';
    }
    return null;
  }

  Map<String, dynamic> _buildSalePayload({
    required Outlet outlet,
    required Shift shift,
    required List<CartLine> lines,
    required List<SalesPayment> payments,
    required double cashTenderedTotal,
    required String customerId,
    required bool allowReceivable,
    required double discount,
    required List<String> promotionCodes,
    required double manualTax,
    required double manualServiceCharge,
    required double donation,
  }) {
    final now = DateTime.now();
    final idempotencyKey =
        'flutter-${now.microsecondsSinceEpoch}-${Random().nextInt(999999)}';
    return {
      'outletId': outlet.id,
      'shiftId': shift.id,
      'idempotencyKey': idempotencyKey,
      'receiptNumber': 'FL-${now.millisecondsSinceEpoch}',
      'items': lines
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
      'payments': payments
          .map(
            (payment) => {'method': payment.method, 'amount': payment.amount},
          )
          .toList(),
      'cashTenderedTotal': cashTenderedTotal,
      if (customerId.trim().isNotEmpty) 'customerId': customerId.trim(),
      'allowReceivable': allowReceivable,
      if (allowReceivable) 'receivableNote': 'Piutang dari kasir mobile',
      'discountTotal': discount,
      'promotionCodes': promotionCodes,
      'taxTotal': manualTax,
      'serviceChargeTotal': manualServiceCharge,
      'donationTotal': donation,
      'source': 'flutter_pos',
      'clientCreatedAt': now.toUtc().toIso8601String(),
    };
  }

  Future<void> _savePendingSales(
    SharedPreferences? prefs,
    List<Map<String, dynamic>> pendingSales,
  ) async {
    await prefs?.setString(pendingKey, jsonEncode(pendingSales));
  }

  Future<void> _savePendingWastes(
    SharedPreferences? prefs,
    List<Map<String, dynamic>> pendingWastes,
  ) async {
    await prefs?.setString(pendingWastesKey, jsonEncode(pendingWastes));
  }

  List<Map<String, dynamic>> _decodeList(String? raw) {
    if (raw == null || raw.isEmpty) {
      return [];
    }
    final decoded = jsonDecode(raw);
    if (decoded is List) {
      return decoded
          .cast<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
    }
    return [];
  }

  bool _isShiftSyncFailure(String error) {
    final normalized = error.toLowerCase();
    return normalized.contains('shift') &&
        (normalized.contains('open') || normalized.contains('aktif'));
  }
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

// ApiException, ApiUnavailable, readableApiError — imported from api_errors.dart
