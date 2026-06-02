import 'dart:convert';

import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:pos_cemilan_kasir/features/home/cubits/auth_cubit.dart';
import 'package:pos_cemilan_kasir/features/home/data/pos_api.dart';
import 'package:pos_cemilan_kasir/features/home/models/pos_models.dart';
import 'package:shared_preferences/shared_preferences.dart';

class WorkspaceState {
  const WorkspaceState({
    required this.outlets,
    required this.catalog,
    required this.promotions,
    required this.canViewAllOutletReports,
    required this.isCatalogLoading,
    required this.isOnline,
    required this.message,
    required this.receiptLayout,
    this.selectedOutlet,
    this.reportOutletId,
    this.activeShift,
  });

  factory WorkspaceState.initial() {
    return WorkspaceState(
      outlets: const [],
      catalog: const [],
      promotions: const [],
      canViewAllOutletReports: false,
      isCatalogLoading: false,
      isOnline: false,
      message: '',
      receiptLayout: ReceiptLayout.defaultLayout(),
    );
  }

  final List<Outlet> outlets;
  final Outlet? selectedOutlet;
  final String? reportOutletId;
  final Shift? activeShift;
  final List<CatalogItem> catalog;
  final List<PromotionRule> promotions;
  final bool canViewAllOutletReports;
  final bool isCatalogLoading;
  final bool isOnline;
  final String message;
  final ReceiptLayout receiptLayout;

  WorkspaceState copyWith({
    List<Outlet>? outlets,
    Outlet? selectedOutlet,
    bool clearSelectedOutlet = false,
    String? reportOutletId,
    bool clearReportOutletId = false,
    Shift? activeShift,
    bool clearActiveShift = false,
    List<CatalogItem>? catalog,
    List<PromotionRule>? promotions,
    bool? canViewAllOutletReports,
    bool? isCatalogLoading,
    bool? isOnline,
    String? message,
    ReceiptLayout? receiptLayout,
  }) {
    return WorkspaceState(
      outlets: outlets ?? this.outlets,
      selectedOutlet: clearSelectedOutlet
          ? null
          : (selectedOutlet ?? this.selectedOutlet),
      reportOutletId: clearReportOutletId
          ? null
          : (reportOutletId ?? this.reportOutletId),
      activeShift: clearActiveShift ? null : (activeShift ?? this.activeShift),
      catalog: catalog ?? this.catalog,
      promotions: promotions ?? this.promotions,
      canViewAllOutletReports:
          canViewAllOutletReports ?? this.canViewAllOutletReports,
      isCatalogLoading: isCatalogLoading ?? this.isCatalogLoading,
      isOnline: isOnline ?? this.isOnline,
      message: message ?? this.message,
      receiptLayout: receiptLayout ?? this.receiptLayout,
    );
  }
}

class WorkspaceCubit extends Cubit<WorkspaceState> {
  WorkspaceCubit() : super(WorkspaceState.initial());

  static const pendingKey = 'pending_sales';
  static const catalogKey = 'cached_catalog';
  static const catalogPrefix = 'cached_catalog_';
  static const promotionsKey = 'cached_promotions';
  static const outletsKey = 'cached_outlets';
  static const selectedOutletKey = 'selected_outlet_id';
  static const receiptLayoutKey = 'receipt_layout';
  static const activeShiftPrefix = 'active_shift_';
  static const allOutletsReportId = '__all_outlets__';

  void restoreFromCache(SharedPreferences prefs) {
    final cachedOutlets = _decodeList(prefs.getString(outletsKey));
    final selectedOutletId = prefs.getString(selectedOutletKey);
    final cachedOutletModels = cachedOutlets
        .map(Outlet.fromJson)
        .where((outlet) => outlet.isActive)
        .toList();

    final selectedOutlet = _pickOutlet(cachedOutletModels, selectedOutletId);
    final cachedCatalog = selectedOutlet == null
        ? _decodeList(prefs.getString(catalogKey))
        : _decodeList(prefs.getString(_catalogKey(selectedOutlet.id)));
    final cachedPromotions = _decodeList(prefs.getString(promotionsKey));
    final cachedShift = selectedOutlet == null
        ? null
        : _decodeMap(prefs.getString(_shiftKey(selectedOutlet.id)));
    emit(
      state.copyWith(
        outlets: cachedOutletModels,
        selectedOutlet: selectedOutlet,
        reportOutletId: selectedOutletId,
        activeShift: cachedShift == null ? null : Shift.fromJson(cachedShift),
        catalog: cachedCatalog.map(CatalogItem.fromJson).toList(),
        promotions: cachedPromotions.map(PromotionRule.fromJson).toList(),
        receiptLayout: ReceiptLayout.fromCache(
          prefs.getString(receiptLayoutKey),
        ),
      ),
    );
  }

  Future<void> loadWorkspace({
    required PosApi api,
    required SharedPreferences? prefs,
    required ReportRange reportRange,
    bool showErrors = true,
  }) async {
    try {
      final allOutlets = await api.listOutlets();
      final canViewAll = await _canFetchAllOutletReport(api, reportRange);
      final receiptLayout = await api.fetchReceiptLayout();
      final promotions = await api.fetchActivePromotions();
      final activeOutlets = allOutlets
          .where((outlet) => outlet.isActive)
          .toList();
      final outlets = canViewAll
          ? activeOutlets
          : await _filterAccessibleOutlets(api, activeOutlets);
      final selected =
          _pickOutlet(outlets, state.selectedOutlet?.id) ??
          _pickOutlet(outlets, state.reportOutletId) ??
          (outlets.isNotEmpty ? outlets.first : null);
      final reportOutletId = canViewAll
          ? (state.reportOutletId ?? allOutletsReportId)
          : selected?.id;

      emit(
        state.copyWith(
          outlets: outlets,
          selectedOutlet: selected,
          canViewAllOutletReports: canViewAll,
          reportOutletId: reportOutletId,
          receiptLayout: receiptLayout,
          promotions: promotions,
          isOnline: true,
          message: state.message,
        ),
      );

      await _saveOutlets(prefs, outlets);
      await prefs?.setString(
        receiptLayoutKey,
        jsonEncode(receiptLayout.toJson()),
      );
      await _savePromotions(prefs, promotions);
      if (selected != null) {
        await prefs?.setString(selectedOutletKey, selected.id);
        await loadShiftAndCatalog(api: api, prefs: prefs, outlet: selected);
      }
    } catch (error) {
      emit(
        state.copyWith(
          isOnline: _serverReachableAfter(error),
          message: showErrors ? readableApiError(error) : state.message,
        ),
      );
    }
  }

  Future<void> selectOutlet({
    required PosApi api,
    required SharedPreferences? prefs,
    required String outletId,
  }) async {
    final outlet = state.outlets
        .where((item) => item.id == outletId)
        .firstOrNull;
    if (outlet == null) {
      return;
    }
    emit(
      state.copyWith(
        selectedOutlet: outlet,
        reportOutletId:
            !state.canViewAllOutletReports ||
                state.reportOutletId != allOutletsReportId
            ? outlet.id
            : state.reportOutletId,
        clearActiveShift: true,
        message: '',
      ),
    );
    await prefs?.setString(selectedOutletKey, outlet.id);
    final cachedShift = _decodeMap(prefs?.getString(_shiftKey(outlet.id)));
    final cachedCatalog = _decodeList(prefs?.getString(_catalogKey(outlet.id)));
    emit(
      state.copyWith(
        activeShift: cachedShift == null ? null : Shift.fromJson(cachedShift),
        clearActiveShift: cachedShift == null,
        catalog: cachedCatalog.map(CatalogItem.fromJson).toList(),
      ),
    );
    await loadShiftAndCatalog(api: api, prefs: prefs, outlet: outlet);
  }

  Future<void> loadShiftAndCatalog({
    required PosApi api,
    required SharedPreferences? prefs,
    required Outlet outlet,
  }) async {
    emit(state.copyWith(isCatalogLoading: true));
    try {
      final results = await Future.wait([
        api.currentShift(outlet.id),
        api.fetchCatalog(outlet.id),
        api.fetchActivePromotions(),
      ]);
      final shift = results[0] as Shift?;
      final catalog = results[1] as List<CatalogItem>;
      final promotions = results[2] as List<PromotionRule>;
      emit(
        state.copyWith(
          activeShift: shift,
          catalog: catalog,
          promotions: promotions,
          isOnline: true,
          message: 'Data outlet diperbarui.',
        ),
      );
      await _saveCatalog(prefs, outlet.id, catalog);
      await _savePromotions(prefs, promotions);
      await _saveActiveShift(prefs, outlet.id, shift);
    } catch (error) {
      emit(
        state.copyWith(
          isOnline: _serverReachableAfter(error),
          message: 'Memakai katalog terakhir. ${readableApiError(error)}',
        ),
      );
    } finally {
      emit(state.copyWith(isCatalogLoading: false));
    }
  }

  Future<void> applyLocalWaste({
    required SharedPreferences? prefs,
    required String outletId,
    required String skuId,
    required double quantityBase,
  }) async {
    final catalog = state.catalog
        .map(
          (item) => item.skuId == skuId
              ? item.copyWith(
                  onHandBaseQty: (item.onHandBaseQty - quantityBase).clamp(
                    0,
                    double.infinity,
                  ),
                )
              : item,
        )
        .toList();
    emit(state.copyWith(catalog: catalog));
    await _saveCatalog(prefs, outletId, catalog);
  }

  Future<void> openShift({
    required PosApi api,
    required SharedPreferences? prefs,
    required double openingCash,
  }) async {
    final outlet = state.selectedOutlet;
    if (outlet == null) {
      return;
    }
    emit(state.copyWith(message: ''));
    try {
      final shift = await api.openShift(outlet.id, openingCash);
      emit(
        state.copyWith(
          activeShift: shift,
          isOnline: true,
          message: 'Shift dibuka.',
        ),
      );
      await _saveActiveShift(prefs, outlet.id, shift);
    } catch (error) {
      emit(
        state.copyWith(
          isOnline: _serverReachableAfter(error),
          message: 'Buka shift gagal. ${readableApiError(error)}',
        ),
      );
    }
  }

  Future<void> closeShift({
    required PosApi api,
    required SharedPreferences? prefs,
    required double actualCash,
  }) async {
    final shift = state.activeShift;
    if (shift == null) {
      return;
    }
    emit(state.copyWith(message: ''));
    try {
      final closed = await api.closeShift(shift.id, actualCash);
      final outletId = state.selectedOutlet?.id;
      emit(
        state.copyWith(
          activeShift: closed.status == 'open' ? closed : null,
          clearActiveShift: closed.status != 'open',
          isOnline: true,
          message: 'Shift ditutup.',
        ),
      );
      if (outletId != null && closed.status != 'open') {
        await _saveActiveShift(prefs, outletId, null);
      }
    } catch (error) {
      emit(
        state.copyWith(
          isOnline: _serverReachableAfter(error),
          message: 'Tutup shift gagal. ${readableApiError(error)}',
        ),
      );
    }
  }

  void clearSession() {
    emit(state.copyWith(clearActiveShift: true, message: ''));
  }

  Future<bool> _canFetchAllOutletReport(
    PosApi api,
    ReportRange reportRange,
  ) async {
    try {
      final period = reportRange.period();
      await api.fetchSalesReport(null, from: period.$1, to: period.$2);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<List<Outlet>> _filterAccessibleOutlets(
    PosApi api,
    List<Outlet> outlets,
  ) async {
    final accessible = <Outlet>[];
    for (final outlet in outlets) {
      try {
        await api.currentShift(outlet.id);
        accessible.add(outlet);
      } on ApiException catch (error) {
        if (error.statusCode != 403) {
          rethrow;
        }
      }
    }
    return accessible;
  }

  Future<void> _saveCatalog(
    SharedPreferences? prefs,
    String outletId,
    List<CatalogItem> catalog,
  ) async {
    final raw = jsonEncode(catalog.map((item) => item.toJson()).toList());
    await prefs?.setString(catalogKey, raw);
    await prefs?.setString(_catalogKey(outletId), raw);
  }

  Future<void> _saveOutlets(
    SharedPreferences? prefs,
    List<Outlet> outlets,
  ) async {
    await prefs?.setString(
      outletsKey,
      jsonEncode(outlets.map((item) => item.toJson()).toList()),
    );
  }

  Future<void> _savePromotions(
    SharedPreferences? prefs,
    List<PromotionRule> promotions,
  ) async {
    await prefs?.setString(
      promotionsKey,
      jsonEncode(promotions.map((item) => item.toJson()).toList()),
    );
  }

  Future<void> _saveActiveShift(
    SharedPreferences? prefs,
    String outletId,
    Shift? shift,
  ) async {
    if (prefs == null) return;
    final key = _shiftKey(outletId);
    if (shift == null || shift.status != 'open') {
      await prefs.remove(key);
      return;
    }
    await prefs.setString(key, jsonEncode(shift.toJson()));
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

  Map<String, dynamic>? _decodeMap(String? raw) {
    if (raw == null || raw.isEmpty) {
      return null;
    }
    final decoded = jsonDecode(raw);
    if (decoded is Map) {
      return Map<String, dynamic>.from(decoded);
    }
    return null;
  }

  String _shiftKey(String outletId) => '$activeShiftPrefix$outletId';

  String _catalogKey(String outletId) => '$catalogPrefix$outletId';

  Outlet? _pickOutlet(List<Outlet> outlets, String? id) {
    if (outlets.isEmpty) {
      return null;
    }
    for (final outlet in outlets) {
      if (outlet.id == id) {
        return outlet;
      }
    }
    return outlets.first;
  }
}

bool _serverReachableAfter(Object error) => error is! ApiUnavailable;

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull {
    final iterator = this.iterator;
    if (iterator.moveNext()) {
      return iterator.current;
    }
    return null;
  }
}
