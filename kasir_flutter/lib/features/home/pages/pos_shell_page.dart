import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:http/http.dart' as http;
import 'package:pos_cemilan_kasir/core/theme/app_palette.dart';
import 'package:pos_cemilan_kasir/features/home/cubits/auth_cubit.dart';
import 'package:pos_cemilan_kasir/features/home/cubits/cart_cubit.dart';
import 'package:pos_cemilan_kasir/features/home/cubits/checkout_cubit.dart';
import 'package:pos_cemilan_kasir/features/home/cubits/workspace_cubit.dart';
import 'package:pos_cemilan_kasir/features/home/data/pos_api.dart';
import 'package:pos_cemilan_kasir/features/home/models/pos_models.dart';
import 'package:pos_cemilan_kasir/features/home/widgets/login_view.dart';
import 'package:pos_cemilan_kasir/features/home/widgets/printer_settings_card.dart';
import 'package:pos_cemilan_kasir/shared/widgets/app_section.dart';
import 'package:pos_cemilan_kasir/shared/utils/api_errors.dart';
import 'package:pos_cemilan_kasir/shared/widgets/shift_indicator.dart';
import 'package:pos_cemilan_kasir/shared/widgets/subscription_bar.dart';
import 'package:shared_preferences/shared_preferences.dart';

part 'pos_shell_widgets.dart';

const _wasteReasons = {
  'crumbs_unsellable': 'Remah tidak layak jual',
  'spilled': 'Tumpah',
  'damaged': 'Rusak',
  'quality_drop': 'Turun kualitas',
  'expired': 'Kedaluwarsa',
  'weighing_difference': 'Selisih timbang',
  'sampling': 'Sampling',
  'internal_use': 'Pemakaian internal',
  'stock_opname_correction': 'Koreksi opname',
  'other': 'Lainnya',
};

class PosShell extends StatefulWidget {
  const PosShell({super.key});

  @override
  State<PosShell> createState() => _PosShellState();
}

class _PosShellState extends State<PosShell> {
  static const _defaultBaseUrl = 'http://localhost:3001';
  static const _printerEnabledKey = 'printer_enabled';
  static const _printerBluetoothAddressKey = 'printer_bluetooth_address';
  static const _printerBluetoothConnectedKey = 'printer_bluetooth_connected';
  static const _receiptLayoutKey = 'receipt_layout';
  static const _receiptLogoCachePrefix = 'receipt_logo_bytes_';
  static const _salesReportCachePrefix = 'sales_report_';
  static const _salesDetailsCachePrefix = 'sales_details_';
  static const _allOutletsReportId = '__all_outlets__';
  static const _idleLogoutDuration = Duration(minutes: 15);
  static const _printerChannel = MethodChannel('pos_cemilan/printer');

  final _emailController = TextEditingController(text: 'admin@email.com');
  final _passwordController = TextEditingController();
  final _baseUrlController = TextEditingController(text: _defaultBaseUrl);
  final _searchController = TextEditingController();
  final _openingCashController = TextEditingController(text: '0');
  final _actualCashController = TextEditingController();
  final _cashMovementAmountController = TextEditingController();
  final _cashMovementReasonController = TextEditingController();
  final _cashMovementNoteController = TextEditingController();
  final _discountController = TextEditingController(text: '0');
  final _promotionCodeController = TextEditingController();
  final _taxController = TextEditingController(text: '0');
  final _serviceChargeController = TextEditingController(text: '0');
  final _donationController = TextEditingController(text: '0');
  final _paidController = TextEditingController();
  final List<String> _paymentMethods = ['cash'];
  final List<TextEditingController> _paymentAmountControllers = [];
  final _cashierNameController = TextEditingController();
  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _wasteQtyController = TextEditingController();
  final _wasteNoteController = TextEditingController();
  final _printerBluetoothController = TextEditingController();

  late PosApi _api;
  late final AuthCubit _authCubit;
  late final WorkspaceCubit _workspaceCubit;
  late final CartCubit _cartCubit;
  late final CheckoutCubit _checkoutCubit;
  SharedPreferences? _prefs;
  Timer? _idleTimer;
  Timer? _quoteTimer;
  Timer? _connectivityProbeTimer;
  Timer? _realtimeReconnectTimer;
  Timer? _realtimeRefreshTimer;
  StreamSubscription<List<ConnectivityResult>>? _connectivitySubscription;
  StreamSubscription<RealtimeEvent>? _realtimeSubscription;

  var _isBooting = true;
  var _isBusy = false;
  var _isSignedIn = false;
  var _isOnline = false;
  var _selectedTab = 0;
  var _reportRange = ReportRange.today;
  var _canViewAllOutletReports = false;
  var _isReportLoading = false;
  var _isCatalogLoading = false;
  var _isQuoteLoading = false;
  var _message = '';
  var _selectedCategory = 'Semua';
  var _wasteReason = 'crumbs_unsellable';
  var _lastToastMessage = '';
  var _printerEnabled = false;
  var _printerConnection = 'bluetooth';
  var _isLoadingBluetoothPrinters = false;
  var _isBluetoothPrinterConnected = false;
  var _isConnectingBluetoothPrinter = false;
  var _isPrintingReceipt = false;
  var _isConnectivityProbeRunning = false;
  var _isRealtimeConnected = false;
  var _isRealtimeRefreshRunning = false;
  var _isApplyingRealtimeRefresh = false;
  var _isAutoSyncRunning = false;
  var _realtimeReconnectAttempt = 0;
  var _cashMovementType = 'cash_in';
  final Set<String> _pendingRealtimeTopics = {};
  String? _connectedBluetoothTarget;
  String? _wasteSkuId;
  String _customerId = '';
  String _activeCartSessionId = 'main';

  CurrentUser? _currentUser;
  List<Outlet> _outlets = [];
  Outlet? _selectedOutlet;
  String? _reportOutletId;
  Shift? _activeShift;
  ShiftSummary? _shiftSummary;
  List<PendingVarianceShift> _pendingVarianceShifts = [];
  SalesReport? _salesReport;
  List<SalesDetail> _salesDetails = [];
  List<CatalogItem> _catalog = [];
  List<Customer> _customers = [];
  List<PromotionRule> _promotions = [];
  List<CartSession> _cartSessions = [CartSession.empty('main', 'Pelanggan 1')];
  List<Map<String, dynamic>> _pendingSales = [];
  List<Map<String, dynamic>> _pendingWastes = [];
  List<BluetoothPrinterDevice> _bluetoothPrinters = [];
  ReceiptLayout _receiptLayout = ReceiptLayout.defaultLayout();

  @override
  void initState() {
    super.initState();
    _authCubit = AuthCubit(defaultBaseUrl: _defaultBaseUrl);
    _workspaceCubit = WorkspaceCubit();
    _cartCubit = CartCubit();
    _checkoutCubit = CheckoutCubit();
    _api = _authCubit.api;
    _paymentAmountControllers.add(_paidController);
    for (final controller in _activityControllers) {
      controller.addListener(_resetIdleTimer);
    }
    for (final controller in _quoteInputControllers) {
      controller.addListener(_scheduleSaleQuoteRefresh);
    }
    _printerBluetoothController.addListener(_handleBluetoothTargetChanged);
    _startConnectivityMonitor();
    _bootstrap();
  }

  @override
  void dispose() {
    _idleTimer?.cancel();
    _quoteTimer?.cancel();
    _connectivityProbeTimer?.cancel();
    _realtimeReconnectTimer?.cancel();
    _realtimeRefreshTimer?.cancel();
    _connectivitySubscription?.cancel();
    _realtimeSubscription?.cancel();
    for (final controller in _activityControllers) {
      controller.removeListener(_resetIdleTimer);
    }
    for (final controller in _quoteInputControllers) {
      controller.removeListener(_scheduleSaleQuoteRefresh);
    }
    _authCubit.close();
    _workspaceCubit.close();
    _cartCubit.close();
    _checkoutCubit.close();
    _printerBluetoothController.removeListener(_handleBluetoothTargetChanged);
    _emailController.dispose();
    _passwordController.dispose();
    _baseUrlController.dispose();
    _searchController.dispose();
    _openingCashController.dispose();
    _actualCashController.dispose();
    _cashMovementAmountController.dispose();
    _cashMovementReasonController.dispose();
    _cashMovementNoteController.dispose();
    _discountController.dispose();
    _promotionCodeController.dispose();
    _taxController.dispose();
    _serviceChargeController.dispose();
    _donationController.dispose();
    for (final controller in _paymentAmountControllers.skip(1)) {
      controller.dispose();
    }
    _paidController.dispose();
    _cashierNameController.dispose();
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    _wasteQtyController.dispose();
    _wasteNoteController.dispose();
    _printerBluetoothController.dispose();
    super.dispose();
  }

  List<TextEditingController> get _activityControllers => [
    _searchController,
    _openingCashController,
    _actualCashController,
    _cashMovementAmountController,
    _cashMovementReasonController,
    _cashMovementNoteController,
    _discountController,
    _promotionCodeController,
    _taxController,
    _serviceChargeController,
    _donationController,
    ..._paymentAmountControllers,
    _cashierNameController,
    _currentPasswordController,
    _newPasswordController,
    _confirmPasswordController,
    _wasteQtyController,
    _wasteNoteController,
    _printerBluetoothController,
  ];

  List<TextEditingController> get _quoteInputControllers => [
    _discountController,
    _promotionCodeController,
    _taxController,
    _serviceChargeController,
    _donationController,
  ];

  Future<void> _bootstrap() async {
    await _authCubit.bootstrap();
    _syncAuthState(_authCubit.state);
    final prefs = _authCubit.prefs;
    if (prefs == null) {
      if (mounted) {
        setState(() => _isBooting = false);
      }
      return;
    }

    final printerBluetooth = prefs.getString(_printerBluetoothAddressKey) ?? '';
    final receiptLayoutJson = prefs.getString(_receiptLayoutKey);
    _printerBluetoothController.text = printerBluetooth;

    setState(() {
      _prefs = prefs;
      _printerEnabled = prefs.getBool(_printerEnabledKey) ?? false;
      _printerConnection = 'bluetooth';
      _isBluetoothPrinterConnected =
          (prefs.getBool(_printerBluetoothConnectedKey) ?? false) &&
          printerBluetooth.isNotEmpty;
      _connectedBluetoothTarget = _isBluetoothPrinterConnected
          ? printerBluetooth
          : null;
      _receiptLayout = ReceiptLayout.fromCache(receiptLayoutJson);
    });

    _workspaceCubit.restoreFromCache(prefs);
    _syncWorkspaceState(_workspaceCubit.state);
    _checkoutCubit.restorePending(prefs);
    _syncCheckoutState(_checkoutCubit.state);

    if (_isSignedIn) {
      _resetIdleTimer();
      await _loadWorkspace(showErrors: false);
      _ensureRealtimeConnected();
      _maybeAutoSyncPending();
    }

    if (mounted) {
      setState(() => _isBooting = false);
    }
  }

  void _syncAuthState(AuthState state) {
    if (!mounted) return;
    final toastMessage = state.message;
    setState(() {
      _api = _authCubit.api;
      _prefs = state.prefs ?? _prefs;
      _isBooting = state.isBooting;
      _isBusy = state.isBusy;
      _isSignedIn = state.isSignedIn;
      _isOnline = state.isOnline;
      _currentUser = state.currentUser;
      _message = state.message;
      if (_baseUrlController.text != state.baseUrl) {
        _baseUrlController.text = state.baseUrl;
      }
      if (state.currentUser != null) {
        _cashierNameController.text = state.currentUser!.name;
      }
      if (!state.isSignedIn) {
        _activeShift = null;
      }
    });
    if (!state.isSignedIn) {
      _stopRealtime();
    }
    if (toastMessage.isNotEmpty) _queueToast(toastMessage);
  }

  void _syncCartState(CartState state) {
    if (!mounted) return;
    final toastMessage = state.message;
    setState(() {
      _cartSessions = state.sessions;
      _activeCartSessionId = state.activeSessionId;
      _isQuoteLoading = state.isQuoteLoading;
      if (state.hasConnectivitySignal) {
        _isOnline = state.isOnline;
      }
      if (state.message.isNotEmpty) {
        _message = state.message;
      }
    });
    if (toastMessage.isNotEmpty) _queueToast(toastMessage);
  }

  void _syncCheckoutState(CheckoutState state) {
    if (!mounted) return;
    final toastMessage = state.message;
    final wasOnline = _isOnline;
    setState(() {
      _pendingSales = state.pendingSales;
      _pendingWastes = state.pendingWastes;
      _isBusy = _authCubit.state.isBusy || state.isBusy;
      _isOnline = state.isOnline;
      if (state.message.isNotEmpty) {
        _message = state.message;
      }
    });
    if (toastMessage.isNotEmpty && !_isApplyingRealtimeRefresh) {
      _queueToast(toastMessage);
    }
    if (!wasOnline && state.isOnline) {
      _maybeAutoSyncPending();
    }
    if (state.isOnline && _isSignedIn) {
      _ensureRealtimeConnected();
      _maybeAutoSyncPending();
    }
  }

  void _syncWorkspaceState(WorkspaceState state) {
    if (!mounted) return;
    final toastMessage = state.message;
    setState(() {
      _outlets = state.outlets;
      _selectedOutlet = state.selectedOutlet;
      _reportOutletId = state.reportOutletId;
      _activeShift = state.activeShift;
      _shiftSummary = state.shiftSummary;
      if (state.activeShift != null && _actualCashController.text.isEmpty) {
        _actualCashController.text = _moneyPlain(
          state.activeShift!.expectedCash,
        );
      }
      _catalog = state.catalog;
      _promotions = state.promotions;
      _canViewAllOutletReports = state.canViewAllOutletReports;
      _isCatalogLoading = state.isCatalogLoading;
      _isOnline = state.isOnline;
      _receiptLayout = state.receiptLayout;
      _applyReceiptPrinterDefaults(state.receiptLayout);
      unawaited(_cacheKnownReceiptLogosForOffline());
      _wasteSkuId = state.catalog.any((item) => item.skuId == _wasteSkuId)
          ? _wasteSkuId
          : state.catalog.firstOrNull?.skuId;
      if (state.message.isNotEmpty) {
        _message = state.message;
      }
    });
    if (toastMessage.isNotEmpty) _queueToast(toastMessage);
  }

  Future<void> _signIn() async {
    await _authCubit.signIn(
      baseUrl: _baseUrlController.text.trim(),
      email: _emailController.text.trim(),
      password: _passwordController.text,
    );
    if (!_authCubit.state.isSignedIn) {
      return;
    }
    _resetIdleTimer();
    if (_authCubit.state.isOnline) {
      await _loadWorkspace();
      _ensureRealtimeConnected();
      _maybeAutoSyncPending();
    } else {
      _showToast('Login offline berhasil.');
    }
  }

  Future<void> _logout({String message = 'Sesi kasir keluar.'}) async {
    _idleTimer?.cancel();
    _stopRealtime();
    await _authCubit.logout(message: message);
    _workspaceCubit.clearSession();
    _cartCubit.reset();
    setState(() {
      _resetPaymentLines();
    });
  }

  void _resetIdleTimer() {
    _idleTimer?.cancel();
    if (!_isSignedIn) {
      return;
    }
    _idleTimer = Timer(_idleLogoutDuration, () {
      if (!mounted || !_isSignedIn) {
        return;
      }
      unawaited(_logout(message: 'Sesi idle 15 menit, otomatis logout.'));
    });
  }

  void _startConnectivityMonitor() {
    final connectivity = Connectivity();
    unawaited(
      connectivity.checkConnectivity().then(_handleConnectivityResults),
    );
    _connectivitySubscription = connectivity.onConnectivityChanged.listen(
      _handleConnectivityResults,
    );
    _connectivityProbeTimer = Timer.periodic(
      const Duration(seconds: 5),
      (_) => unawaited(_probeApiConnectivity()),
    );
  }

  void _handleConnectivityResults(List<ConnectivityResult> results) {
    final hasTransport = results.any((item) => item != ConnectivityResult.none);
    if (!hasTransport) {
      if (mounted && _isOnline) {
        setState(() => _isOnline = false);
      }
      _stopRealtime();
      return;
    }
    unawaited(_probeApiConnectivity());
  }

  Future<void> _probeApiConnectivity() async {
    if (_isConnectivityProbeRunning) return;
    _isConnectivityProbeRunning = true;
    try {
      final online = await _api.checkHealth();
      final wasOnline = _isOnline;
      if (mounted && online != _isOnline) {
        setState(() => _isOnline = online);
      }
      if (!wasOnline && online && _isSignedIn) {
        _ensureRealtimeConnected();
        _maybeAutoSyncPending();
      }
      if (!online) {
        _stopRealtime();
      }
    } finally {
      _isConnectivityProbeRunning = false;
    }
  }

  Future<void> _saveUserSettings() async {
    await _authCubit.saveUserSettings(
      name: _cashierNameController.text.trim(),
      currentPassword: _currentPasswordController.text,
      newPassword: _newPasswordController.text,
      confirmPassword: _confirmPasswordController.text,
    );
    if (_authCubit.state.currentUser != null &&
        _authCubit.state.message.contains('berhasil')) {
      _currentPasswordController.clear();
      _newPasswordController.clear();
      _confirmPasswordController.clear();
    }
  }

  Future<void> _loadWorkspace({bool showErrors = true}) async {
    await _workspaceCubit.loadWorkspace(
      api: _api,
      prefs: _prefs,
      reportRange: _reportRange,
      showErrors: showErrors,
    );
    await _loadCustomers(showErrors: showErrors);
    await _savePrinterSettings(showMessage: false);
    if (_selectedOutlet != null) {
      await _loadPendingVarianceShifts(showErrors: false);
      await _loadSalesReport(showErrors: false);
    }
  }

  Future<void> _loadPendingVarianceShifts({bool showErrors = true}) async {
    final outlet = _selectedOutlet;
    final role = _currentUser?.role;
    if (!_isSignedIn ||
        !_isOnline ||
        outlet == null ||
        (role != 'owner' && role != 'admin_outlet')) {
      if (mounted) setState(() => _pendingVarianceShifts = []);
      return;
    }
    try {
      final rows = await _api.pendingVarianceShifts(outlet.id);
      if (mounted) setState(() => _pendingVarianceShifts = rows);
    } catch (_) {
      if (showErrors && mounted) {
        setState(() => _message = 'Data approval selisih shift gagal dimuat.');
      }
    }
  }

  Future<void> _loadCustomers({bool showErrors = true}) async {
    if (!_isSignedIn || !_isOnline) return;
    try {
      final customers = await _api.fetchCustomers();
      if (!mounted) return;
      setState(() {
        _customers = customers;
        if (_customerId.isNotEmpty &&
            !customers.any((item) => item.id == _customerId)) {
          _customerId = '';
        }
      });
    } catch (_) {
      if (showErrors && mounted) {
        setState(() => _message = 'Data pelanggan gagal dimuat.');
      }
    }
  }

  void _applyReceiptPrinterDefaults(ReceiptLayout layout) {
    final remotePrinterName = layout.printerName.trim();
    final hasLocalBluetoothPrinter = _printerBluetoothController.text
        .trim()
        .isNotEmpty;

    if (remotePrinterName.isNotEmpty &&
        _printerBluetoothController.text.trim().isEmpty) {
      _printerBluetoothController.text = remotePrinterName;
    }

    _printerConnection = 'bluetooth';
    if (layout.autoPrint) {
      _printerEnabled = true;
      if (!hasLocalBluetoothPrinter && remotePrinterName.isNotEmpty) {
        _printerBluetoothController.text = remotePrinterName;
      }
    }
  }

  void _handleBluetoothTargetChanged() {
    final target = _printerBluetoothController.text.trim();
    if (!_isBluetoothPrinterConnected ||
        target == (_connectedBluetoothTarget ?? '')) {
      return;
    }
    setState(() {
      _isBluetoothPrinterConnected = false;
      _connectedBluetoothTarget = null;
    });
    unawaited(_prefs?.setBool(_printerBluetoothConnectedKey, false));
  }

  Future<void> _loadShiftAndCatalog(Outlet outlet) async {
    await _workspaceCubit.loadShiftAndCatalog(
      api: _api,
      prefs: _prefs,
      outlet: outlet,
    );
  }

  bool _serverReachableAfter(Object error) => serverReachableAfter(error);

  Future<void> _loadSalesReport({bool showErrors = true}) async {
    final reportOutletId =
        _canViewAllOutletReports && _reportOutletId == _allOutletsReportId
        ? null
        : (_reportOutletId ?? _selectedOutlet?.id);
    if (reportOutletId == null && !_canViewAllOutletReports) {
      return;
    }
    setState(() => _isReportLoading = true);
    try {
      final period = _reportRange.period();
      final results = await Future.wait([
        _api.fetchSalesReport(reportOutletId, from: period.$1, to: period.$2),
        _api.fetchSalesDetails(reportOutletId, from: period.$1, to: period.$2),
      ]);
      final report = results[0] as SalesReport;
      final details = results[1] as List<SalesDetail>;
      unawaited(_cacheSalesDetailLogos(details));
      await _saveSalesReportCache(
        outletId: reportOutletId,
        range: _reportRange,
        from: period.$1,
        to: period.$2,
        report: report,
        details: details,
      );
      setState(() {
        _salesReport = report;
        _salesDetails = details;
        _isOnline = true;
      });
    } catch (error) {
      final period = _reportRange.period();
      final restored = _restoreSalesReportCache(
        outletId: reportOutletId,
        range: _reportRange,
        from: period.$1,
        to: period.$2,
      );
      setState(() {
        _isOnline = _serverReachableAfter(error);
        if (showErrors && restored) {
          _message =
              'Laporan memakai cache lokal terakhir karena server belum terhubung.';
        } else if (showErrors) {
          _message = 'Laporan belum bisa dimuat. ${_readableError(error)}';
        }
      });
    } finally {
      if (mounted) {
        setState(() => _isReportLoading = false);
      }
    }
  }

  Future<void> _saveSalesReportCache({
    required String? outletId,
    required ReportRange range,
    required DateTime from,
    required DateTime to,
    required SalesReport report,
    required List<SalesDetail> details,
  }) async {
    final reportKey = _salesReportCacheKey(outletId, range, from, to);
    final detailsKey = _salesDetailsCacheKey(outletId, range, from, to);
    await _prefs?.setString(reportKey, jsonEncode(report.toJson()));
    await _prefs?.setString(
      detailsKey,
      jsonEncode(details.map((detail) => detail.toJson()).toList()),
    );
  }

  bool _restoreSalesReportCache({
    required String? outletId,
    required ReportRange range,
    required DateTime from,
    required DateTime to,
  }) {
    final reportRaw = _prefs?.getString(
      _salesReportCacheKey(outletId, range, from, to),
    );
    final detailsRaw = _prefs?.getString(
      _salesDetailsCacheKey(outletId, range, from, to),
    );
    if (reportRaw == null || detailsRaw == null) {
      return false;
    }
    try {
      final report = SalesReport.fromJson(
        Map<String, dynamic>.from(jsonDecode(reportRaw)),
      );
      final details = ((jsonDecode(detailsRaw) as List?) ?? [])
          .map(
            (detail) => SalesDetail.fromJson(Map<String, dynamic>.from(detail)),
          )
          .toList();
      _salesReport = report;
      _salesDetails = details;
      return true;
    } catch (_) {
      return false;
    }
  }

  String _salesReportCacheKey(
    String? outletId,
    ReportRange range,
    DateTime from,
    DateTime to,
  ) =>
      '$_salesReportCachePrefix${_reportCacheScope(outletId, range, from, to)}';

  String _salesDetailsCacheKey(
    String? outletId,
    ReportRange range,
    DateTime from,
    DateTime to,
  ) =>
      '$_salesDetailsCachePrefix${_reportCacheScope(outletId, range, from, to)}';

  String _reportCacheScope(
    String? outletId,
    ReportRange range,
    DateTime from,
    DateTime to,
  ) {
    final outletPart = outletId?.isNotEmpty == true ? outletId! : 'all';
    return '${range.name}_${_cacheDatePart(from)}_${_cacheDatePart(to)}_$outletPart';
  }

  String _cacheDatePart(DateTime value) {
    final year = value.year.toString().padLeft(4, '0');
    final month = value.month.toString().padLeft(2, '0');
    final day = value.day.toString().padLeft(2, '0');
    return '$year$month$day';
  }

  Future<void> _changeReportRange(ReportRange range) async {
    setState(() => _reportRange = range);
    await _loadSalesReport();
  }

  Future<void> _changeReportOutlet(String outletId) async {
    setState(() => _reportOutletId = outletId);
    await _loadSalesReport();
  }

  Future<void> _selectOutlet(String id) async {
    _cartCubit.reset();
    setState(() {
      _resetPaymentLines();
      _customerId = '';
      _message = '';
    });
    await _runBusy(
      () =>
          _workspaceCubit.selectOutlet(api: _api, prefs: _prefs, outletId: id),
    );
    await _loadSalesReport(showErrors: false);
  }

  Future<void> _openShift() async {
    if (_selectedOutlet == null) {
      return;
    }
    final openingCash = _parseNumber(_openingCashController.text);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => _PosConfirmDialog(
        title: 'Buka shift kasir?',
        message:
            'Shift akan aktif untuk outlet ini. Transaksi baru masuk ke shift yang dibuka.',
        confirmLabel: 'Buka shift',
        icon: Icons.lock_open_outlined,
        details: [
          _PosConfirmDetail('Outlet', _selectedOutlet!.name),
          _PosConfirmDetail('Modal awal', _money(openingCash)),
        ],
      ),
    );
    if (confirmed != true) {
      return;
    }
    await _runBusy(
      () => _workspaceCubit.openShift(
        api: _api,
        prefs: _prefs,
        openingCash: openingCash,
      ),
    );
    final shift = _workspaceCubit.state.activeShift;
    if (shift != null) {
      _actualCashController.text = _moneyPlain(shift.expectedCash);
    }
  }

  Future<void> _closeShift() async {
    if (_activeShift == null) {
      return;
    }
    final pendingForOutlet = _pendingSyncForSelectedOutlet;
    if (pendingForOutlet > 0) {
      final message =
          'Sync dulu $pendingForOutlet antrean offline sebelum tutup shift supaya data shift konsisten.';
      setState(() => _message = message);
      _showToast(message);
      return;
    }
    final actualCash = _parseNumber(_actualCashController.text);
    final variance = actualCash - _activeShift!.expectedCash;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => _PosConfirmDialog(
        title: 'Tutup shift kasir?',
        message:
            'Shift akan dikunci. Transaksi berikutnya wajib buka shift baru.',
        confirmLabel: 'Tutup shift',
        icon: Icons.lock_outline,
        danger: variance.abs() >= 1,
        details: [
          _PosConfirmDetail('Kas sistem', _money(_activeShift!.expectedCash)),
          _PosConfirmDetail('Kas aktual', _money(actualCash)),
          _PosConfirmDetail(
            'Selisih',
            _money(variance),
            negative: variance < 0,
          ),
        ],
      ),
    );
    if (confirmed != true) {
      return;
    }
    await _runBusy(
      () => _workspaceCubit.closeShift(
        api: _api,
        prefs: _prefs,
        actualCash: actualCash,
      ),
    );
    if (_workspaceCubit.state.activeShift == null) {
      _cartCubit.reset();
      setState(_resetPaymentLines);
    }
    await _loadPendingVarianceShifts(showErrors: false);
  }

  Future<void> _refreshShiftSummary() async {
    await _workspaceCubit.loadShiftSummary(api: _api);
  }

  Future<void> _saveCashMovement() async {
    await _runBusy(
      () => _workspaceCubit.createCashMovement(
        api: _api,
        amount: _parseNumber(_cashMovementAmountController.text),
        type: _cashMovementType,
        reason: _cashMovementReasonController.text.trim(),
        note: _cashMovementNoteController.text.trim(),
      ),
      failurePrefix: 'Mutasi kas gagal',
    );
    if (_workspaceCubit.state.message.contains('dicatat')) {
      _cashMovementAmountController.clear();
      _cashMovementReasonController.clear();
      _cashMovementNoteController.clear();
    }
  }

  String? _firstStockValidationMessage() {
    return _cartCubit.firstStockValidationMessage();
  }

  void _addToCart(CatalogItem item) {
    final changed = _cartCubit.addToCart(item);
    if (changed) _lastToastMessage = '';
    if (changed) _scheduleSaleQuoteRefresh();
  }

  void _changeCartQuantity(CartLine line, double quantity) {
    final changed = _cartCubit.changeQuantity(line, quantity);
    if (changed) _scheduleSaleQuoteRefresh();
  }

  void _changeCartUnit(CartLine line, UnitChoice unit) {
    final changed = _cartCubit.changeUnit(line, unit);
    if (changed) _scheduleSaleQuoteRefresh();
  }

  Future<void> _editQuantity(CartLine line) async {
    final value = await showDialog<double>(
      context: context,
      builder: (context) => _QuantityEditDialog(
        productName: line.item.skuName,
        unitLabel: line.item.trackInventory ? line.unitLabel : '',
        initialValue: _qty(line.quantity),
      ),
    );
    if (value != null) {
      _changeCartQuantity(line, value);
    }
  }

  void _showWasteSheet() {
    if (_selectedOutlet == null) {
      setState(() => _message = 'Pilih outlet terlebih dahulu.');
      return;
    }
    if (_catalog.isEmpty) {
      setState(() => _message = 'Katalog belum dimuat.');
      return;
    }
    _wasteSkuId ??= _catalog.first.skuId;
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) {
          final selectedItem =
              _catalog.where((item) => item.skuId == _wasteSkuId).firstOrNull ??
              _catalog.first;
          return SafeArea(
            child: Padding(
              padding: EdgeInsets.fromLTRB(
                14,
                0,
                14,
                MediaQuery.of(context).viewInsets.bottom + 14,
              ),
              child: SingleChildScrollView(
                child: AppSection(
                  title: 'Input Remahan',
                  subtitle:
                      'Catat stok tidak layak jual agar balance berkurang',
                  icon: Icons.remove_shopping_cart_outlined,
                  headerColor: AppPalette.red,
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        DropdownButtonFormField<String>(
                          isExpanded: true,
                          initialValue: selectedItem.skuId,
                          decoration: const InputDecoration(
                            labelText: 'Produk / SKU',
                            prefixIcon: Icon(Icons.inventory_2_outlined),
                          ),
                          items: _catalog
                              .map(
                                (item) => DropdownMenuItem(
                                  value: item.skuId,
                                  child: Text(
                                    '${item.skuCode} - ${item.skuName}',
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              )
                              .toList(),
                          onChanged: (value) {
                            if (value == null) return;
                            setState(() => _wasteSkuId = value);
                            setSheetState(() {});
                          },
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: _wasteQtyController,
                          keyboardType: const TextInputType.numberWithOptions(
                            decimal: true,
                          ),
                          inputFormatters: const [
                            IndonesianNumberInputFormatter(decimal: true),
                          ],
                          decoration: InputDecoration(
                            labelText:
                                'Qty remah (${selectedItem.baseUnitCode ?? 'unit'})',
                            prefixIcon: const Icon(Icons.scale_outlined),
                          ),
                        ),
                        const SizedBox(height: 10),
                        DropdownButtonFormField<String>(
                          isExpanded: true,
                          initialValue: _wasteReason,
                          decoration: const InputDecoration(
                            labelText: 'Alasan',
                            prefixIcon: Icon(Icons.report_problem_outlined),
                          ),
                          items: _wasteReasons.entries
                              .map(
                                (entry) => DropdownMenuItem(
                                  value: entry.key,
                                  child: Text(entry.value),
                                ),
                              )
                              .toList(),
                          onChanged: (value) {
                            if (value == null) return;
                            setState(() => _wasteReason = value);
                            setSheetState(() {});
                          },
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: _wasteNoteController,
                          minLines: 2,
                          maxLines: 3,
                          decoration: const InputDecoration(
                            labelText: 'Catatan',
                            prefixIcon: Icon(Icons.notes_outlined),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          selectedItem.trackInventory
                              ? 'Stok tersedia: ${_qty(selectedItem.availableBaseQty)} ${selectedItem.baseUnitCode ?? 'unit'}'
                              : 'Produk non-stok tidak bisa dicatat sebagai remahan.',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        const SizedBox(height: 14),
                        FilledButton.icon(
                          style: FilledButton.styleFrom(
                            backgroundColor: AppPalette.red,
                            foregroundColor: AppPalette.white,
                          ),
                          onPressed: _isBusy
                              ? null
                              : () async {
                                  final success = await _submitWaste();
                                  if (success &&
                                      context.mounted &&
                                      Navigator.canPop(context)) {
                                    Navigator.pop(context);
                                  }
                                },
                          icon: const Icon(Icons.save_outlined),
                          label: Text(_isBusy ? 'Menyimpan' : 'Simpan Remahan'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Future<bool> _submitWaste() async {
    final outlet = _selectedOutlet;
    final item = _catalog
        .where((catalogItem) => catalogItem.skuId == _wasteSkuId)
        .firstOrNull;
    final quantity = _parseNumber(_wasteQtyController.text);
    if (outlet == null || item == null) {
      setState(() => _message = 'Pilih outlet dan produk terlebih dahulu.');
      return false;
    }
    if (item.baseUnitId == null || item.baseUnitId!.isEmpty) {
      setState(() => _message = 'Satuan dasar produk belum tersedia.');
      return false;
    }
    if (!item.trackInventory) {
      setState(
        () => _message = 'Produk non-stok tidak bisa dicatat sebagai remahan.',
      );
      return false;
    }
    if (quantity <= 0) {
      setState(() => _message = 'Qty remah harus lebih dari 0.');
      return false;
    }
    if (quantity > item.availableBaseQty + 0.000001) {
      setState(
        () => _message =
            'Qty remah melebihi stok tersedia (${_qty(item.availableBaseQty)} ${item.baseUnitCode ?? 'unit'}).',
      );
      return false;
    }

    var success = false;
    await _runBusy(() async {
      success = await _checkoutCubit.recordWaste(
        api: _api,
        prefs: _prefs,
        outletId: outlet.id,
        skuId: item.skuId,
        quantity: quantity,
        unitId: item.baseUnitId!,
        reason: _wasteReason,
        note: _wasteNoteController.text.trim(),
      );
      if (!success) {
        return;
      }
      _wasteQtyController.clear();
      _wasteNoteController.clear();
      if (_checkoutCubit.state.isOnline) {
        await _loadShiftAndCatalog(outlet);
      } else {
        await _workspaceCubit.applyLocalWaste(
          prefs: _prefs,
          outletId: outlet.id,
          skuId: item.skuId,
          quantityBase: quantity,
        );
      }
      setState(() {
        _isOnline = _checkoutCubit.state.isOnline;
        _message = _checkoutCubit.state.message;
      });
    }, failurePrefix: 'Input remahan gagal');
    return success;
  }

  Future<void> _approveShiftVariance(PendingVarianceShift item) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => _PosConfirmDialog(
        title: 'Approve selisih shift?',
        message:
            'Shift ${item.cashierName} dengan selisih ${_money(item.cashVariance)} akan disetujui.',
        confirmLabel: 'Approve',
        icon: Icons.verified_outlined,
      ),
    );
    if (confirmed != true) return;
    await _runBusy(() async {
      await _api.approveShiftVariance(item.id);
      _showToast('Selisih shift berhasil di-approve.');
      await _loadPendingVarianceShifts(showErrors: false);
      await _loadSalesReport(showErrors: false);
    }, failurePrefix: 'Approve selisih shift gagal');
  }

  Future<void> _checkout() async {
    final outlet = _selectedOutlet;
    final shift = _activeShift;
    final stockMessage = _firstStockValidationMessage();
    if (_hasReceivablePayment && _customerId.isEmpty) {
      const message = 'Pilih pelanggan untuk pembayaran piutang.';
      setState(() => _message = message);
      _showToast(message);
      return;
    }
    await _refreshSaleQuote(showErrors: true);
    if (_promotionCodes.isNotEmpty && _currentQuote == null) {
      const message =
          'Kode promo belum ada di cache lokal. Sambungkan online sekali untuk sinkron promo.';
      setState(() => _message = message);
      _showToast(message);
      return;
    }
    final payments = _salePayments;
    final realPaymentIndexes = <int>[
      for (var index = 0; index < _paymentMethods.length; index += 1)
        if (_paymentMethods[index] != 'receivable') index,
    ];
    final hasEmptySplitAmount =
        (realPaymentIndexes.length > 1 || _hasReceivablePayment) &&
        realPaymentIndexes.any(
          (index) => _parseNumber(_paymentAmountControllers[index].text) <= 0,
        );
    final result = await _checkoutCubit.checkout(
      api: _api,
      prefs: _prefs,
      outlet: outlet,
      shift: shift,
      cashierName: _currentUser?.name ?? '',
      logoUrl: _receiptLogoUrl,
      lines: List<CartLine>.from(_cart),
      payments: payments,
      subtotal: _subtotal,
      discount: _displayDiscountTotal,
      manualDiscount: _discount,
      tax: _taxTotal,
      manualTax: _manualTaxTotal,
      serviceCharge: _serviceChargeTotal,
      manualServiceCharge: _manualServiceChargeTotal,
      donation: _donationTotal,
      rounding: _roundingTotal,
      grandTotal: _grandTotal,
      cashTenderedTotal: _cashTenderedTotal,
      changeTotal: _changeTotal,
      customerId: _customerId,
      hasReceivablePayment: _hasReceivablePayment,
      receivableAmount: _receivableTotal,
      nonCashOverpaid: _nonCashOverpaid,
      promotionCodes: _promotionCodes,
      stockMessage: stockMessage,
      hasEmptySplitAmount: hasEmptySplitAmount,
    );
    if (result == null) {
      return;
    }

    _completeActiveCartSession();
    _discountController.text = '0';
    _promotionCodeController.clear();
    _taxController.text = '0';
    _serviceChargeController.text = '0';
    _donationController.text = '0';
    setState(() => _customerId = '');
    _resetPaymentLines();
    _showToast(result.toast);
    await _printReceipt(result.receiptData);
    if (result.isOnline && outlet != null) {
      await _loadShiftAndCatalog(outlet);
      await _loadSalesReport(showErrors: false);
    }
  }

  Future<void> _openPaymentSheet() async {
    final outlet = _selectedOutlet;
    final shift = _activeShift;
    if (outlet == null) {
      setState(() => _message = 'Pilih outlet terlebih dahulu.');
      return;
    }
    if (shift == null) {
      setState(() => _message = 'Buka shift sebelum transaksi.');
      return;
    }
    if (_cart.isEmpty) {
      setState(() => _message = 'Keranjang masih kosong.');
      return;
    }
    final stockMessage = _firstStockValidationMessage();
    if (stockMessage != null) {
      setState(() => _message = stockMessage);
      return;
    }
    await _refreshSaleQuote(showErrors: true);
    if (!mounted) return;

    final shouldCheckout = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      showDragHandle: false,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            void refreshSheet() {
              setState(() {});
              setSheetState(() {});
            }

            return SafeArea(
              child: Padding(
                padding: EdgeInsets.fromLTRB(
                  12,
                  0,
                  12,
                  MediaQuery.of(context).viewInsets.bottom + 16,
                ),
                child: Container(
                  decoration: BoxDecoration(
                    color: AppPalette.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppPalette.line),
                    boxShadow: [
                      BoxShadow(
                        color: AppPalette.navy.withValues(alpha: 0.18),
                        blurRadius: 28,
                        offset: const Offset(0, 14),
                      ),
                    ],
                  ),
                  padding: const EdgeInsets.all(16),
                  child: _PaymentSheetContent(
                    total: _grandTotal,
                    donationController: _donationController,
                    roundingTotal: _roundingTotal,
                    paidTotal: _paidTotal,
                    changeTotal: _changeTotal,
                    customers: _customers,
                    customerId: _customerId,
                    paymentMethods: _paymentMethods,
                    paymentAmountControllers: _paymentAmountControllers,
                    onCustomerChanged: (value) {
                      setState(() => _customerId = value ?? '');
                      refreshSheet();
                    },
                    onPaymentMethodChanged: (index, method) {
                      _setPaymentMethod(index, method);
                      refreshSheet();
                    },
                    onPaymentAmountChanged: refreshSheet,
                    onDonationChanged: () {
                      _scheduleSaleQuoteRefresh();
                      refreshSheet();
                    },
                    onAddPayment: () {
                      _addPaymentLine();
                      refreshSheet();
                    },
                    onRemovePayment: (index) {
                      _removePaymentLine(index);
                      refreshSheet();
                    },
                    onCancel: () => Navigator.pop(context, false),
                    onSubmit: () => Navigator.pop(context, true),
                  ),
                ),
              ),
            );
          },
        );
      },
    );

    if (shouldCheckout == true) {
      await _checkout();
    }
  }

  Future<void> _printReceipt(ReceiptData receipt) async {
    if (!_printerEnabled && !_receiptLayout.autoPrint) {
      const message = 'Printer kasir belum aktif.';
      setState(() => _message = message);
      _showToast(message);
      return;
    }
    setState(() {
      _isPrintingReceipt = true;
      _message = 'Mengirim struk ke printer...';
    });
    _showToast('Mengirim struk ke printer...');
    try {
      final content = buildReceiptText(_receiptLayout, receipt);
      final logoRasterBase64 = await _buildReceiptLogoRasterBase64(receipt);
      if (!_isBluetoothPrinterConnected) {
        final message =
            'Printer Bluetooth belum konek. Pilih printer lalu tekan Konek di Setting kasir.';
        setState(() => _message = message);
        _showToast(message);
        return;
      }
      final target = _printerBluetoothController.text.trim().isNotEmpty
          ? _printerBluetoothController.text.trim()
          : _receiptLayout.printerName.trim();
      if (target.isEmpty) {
        const message =
            'Printer Bluetooth belum dipilih. Pilih printer di menu Setting kasir.';
        setState(() => _message = message);
        _showToast(message);
        return;
      }
      await _printerChannel.invokeMethod('printBluetooth', {
        'target': target,
        'text': content,
        if (logoRasterBase64 != null) 'logoRasterBase64': logoRasterBase64,
      });
      const message = 'Struk berhasil dikirim ke printer Bluetooth.';
      setState(() => _message = message);
      _showToast(message);
    } catch (error) {
      final message = 'Print struk gagal. ${_readableError(error)}';
      setState(() => _message = message);
      _showToast(message);
    } finally {
      if (mounted) {
        setState(() => _isPrintingReceipt = false);
      }
    }
  }

  Future<String?> _buildReceiptLogoRasterBase64(ReceiptData receipt) async {
    if (!_receiptLayout.header.contains('logo')) {
      return null;
    }
    final logoUrl = receipt.logoUrl?.trim().isNotEmpty == true
        ? receipt.logoUrl!.trim()
        : _receiptLayout.logoUrl.trim();
    if (logoUrl.isEmpty) {
      return null;
    }

    try {
      final bytes = await _loadLogoBytes(logoUrl);
      if (bytes == null || bytes.isEmpty) {
        return null;
      }
      final raster = await _buildEscPosLogoRaster(
        bytes,
        targetWidth: _receiptLayout.paperWidth == '80' ? 240 : 192,
      );
      if (raster.isEmpty) {
        return null;
      }
      return base64Encode(raster);
    } catch (_) {
      return null;
    }
  }

  Future<Uint8List?> _loadLogoBytes(String logoUrl) async {
    if (logoUrl.startsWith('data:image')) {
      final commaIndex = logoUrl.indexOf(',');
      if (commaIndex < 0) return null;
      final bytes = base64Decode(logoUrl.substring(commaIndex + 1));
      await _saveLogoBytes(logoUrl, bytes);
      return bytes;
    }
    if (!_isOnline) {
      final cachedBytes = _cachedLogoBytes(logoUrl);
      if (cachedBytes != null) {
        return cachedBytes;
      }
    }
    final uri = _resolveAssetUri(logoUrl);
    if (uri == null) return null;
    try {
      final response = await http.get(uri).timeout(const Duration(seconds: 6));
      if (response.statusCode >= 200 && response.statusCode < 300) {
        await _saveLogoBytes(logoUrl, response.bodyBytes);
        return response.bodyBytes;
      }
    } catch (_) {
      // Offline printing falls through to the cached bytes below.
    }
    return _cachedLogoBytes(logoUrl);
  }

  Future<void> _cacheKnownReceiptLogosForOffline() async {
    final logoUrls = <String>{
      if (_receiptLogoUrl?.isNotEmpty == true) _receiptLogoUrl!,
      for (final outlet in _outlets)
        if (outlet.logoUrl?.trim().isNotEmpty == true) outlet.logoUrl!.trim(),
      if (_receiptLayout.logoUrl.trim().isNotEmpty)
        _receiptLayout.logoUrl.trim(),
    };
    await _cacheLogoUrls(logoUrls);
  }

  Future<void> _cacheSalesDetailLogos(List<SalesDetail> details) async {
    await _cacheLogoUrls(
      details
          .map((detail) => detail.outletLogoUrl?.trim())
          .whereType<String>()
          .where((logoUrl) => logoUrl.isNotEmpty),
    );
  }

  Future<void> _cacheLogoUrls(Iterable<String> logoUrls) async {
    for (final logoUrl in logoUrls.toSet()) {
      await _loadLogoBytes(logoUrl);
    }
  }

  Uint8List? _cachedLogoBytes(String logoUrl) {
    final raw = _prefs?.getString(_logoCacheKey(logoUrl));
    if (raw == null || raw.isEmpty) {
      return null;
    }
    try {
      return base64Decode(raw);
    } catch (_) {
      return null;
    }
  }

  Future<void> _saveLogoBytes(String logoUrl, Uint8List bytes) async {
    if (bytes.isEmpty) {
      return;
    }
    await _prefs?.setString(_logoCacheKey(logoUrl), base64Encode(bytes));
  }

  String _logoCacheKey(String logoUrl) {
    final encoded = base64Url.encode(utf8.encode(logoUrl)).replaceAll('=', '');
    return '$_receiptLogoCachePrefix$encoded';
  }

  Uri? _resolveAssetUri(String rawUrl) {
    final parsed = Uri.tryParse(rawUrl);
    if (parsed == null) return null;
    if (parsed.hasScheme) return parsed;

    final base = Uri.tryParse(_api.baseUrl);
    if (base == null) return null;
    if (rawUrl.startsWith('/')) {
      return base.resolve(rawUrl);
    }
    return base.resolve('/$rawUrl');
  }

  Future<Uint8List> _buildEscPosLogoRaster(
    Uint8List imageBytes, {
    required int targetWidth,
  }) async {
    final codec = await ui.instantiateImageCodec(
      imageBytes,
      targetWidth: targetWidth,
    );
    final frame = await codec.getNextFrame();
    final image = frame.image;
    final byteData = await image.toByteData(format: ui.ImageByteFormat.rawRgba);
    if (byteData == null) {
      return Uint8List(0);
    }

    final width = image.width;
    final height = image.height;
    final widthBytes = (width + 7) ~/ 8;
    final data = byteData.buffer.asUint8List();
    final raster = <int>[
      0x1B, 0x61, 0x01, // center
      0x1D, 0x76, 0x30, 0x00,
      widthBytes & 0xFF,
      (widthBytes >> 8) & 0xFF,
      height & 0xFF,
      (height >> 8) & 0xFF,
    ];

    for (var y = 0; y < height; y += 1) {
      for (var xByte = 0; xByte < widthBytes; xByte += 1) {
        var value = 0;
        for (var bit = 0; bit < 8; bit += 1) {
          final x = xByte * 8 + bit;
          if (x >= width) continue;
          final index = (y * width + x) * 4;
          final red = data[index];
          final green = data[index + 1];
          final blue = data[index + 2];
          final alpha = data[index + 3];
          final luminance = (red * 0.299) + (green * 0.587) + (blue * 0.114);
          if (alpha > 120 && luminance < 190) {
            value |= 0x80 >> bit;
          }
        }
        raster.add(value);
      }
    }
    raster.addAll([0x0A, 0x1B, 0x61, 0x00]);
    return Uint8List.fromList(raster);
  }

  Future<void> _savePrinterSettings({bool showMessage = true}) async {
    await _prefs?.setBool(_printerEnabledKey, _printerEnabled);
    await _prefs?.setString(
      _printerBluetoothAddressKey,
      _printerBluetoothController.text.trim(),
    );
    await _prefs?.setBool(
      _printerBluetoothConnectedKey,
      _isBluetoothPrinterConnected,
    );
    if (showMessage) {
      setState(() => _message = 'Setting printer disimpan.');
    }
  }

  Future<void> _loadBluetoothPrinters() async {
    setState(() {
      _isLoadingBluetoothPrinters = true;
      _message = '';
    });
    try {
      final result = await _printerChannel.invokeMethod<List<dynamic>>(
        'listBluetoothDevices',
      );
      final devices = (result ?? [])
          .whereType<Map<dynamic, dynamic>>()
          .map(BluetoothPrinterDevice.fromMap)
          .toList();
      if (!mounted) return;
      setState(() {
        _bluetoothPrinters = devices;
        _message = devices.isEmpty
            ? 'Belum ada perangkat Bluetooth yang sudah dipairing.'
            : 'Ditemukan ${devices.length} perangkat Bluetooth.';
      });
    } catch (error) {
      if (!mounted) return;
      setState(
        () => _message =
            'Gagal memuat perangkat Bluetooth. ${_readableError(error)}',
      );
    } finally {
      if (mounted) {
        setState(() => _isLoadingBluetoothPrinters = false);
      }
    }
  }

  Future<void> _connectBluetoothPrinter(PrinterDeviceViewModel device) async {
    setState(() {
      _isConnectingBluetoothPrinter = true;
      _message = 'Menghubungkan ke printer ${device.displayName}...';
    });
    try {
      await _printerChannel.invokeMethod('connectBluetooth', {
        'target': device.address,
      });
      if (!mounted) return;
      _printerBluetoothController.text = device.address;
      setState(() {
        _printerConnection = 'bluetooth';
        _printerEnabled = true;
        _isBluetoothPrinterConnected = true;
        _connectedBluetoothTarget = device.address;
        _message =
            'Printer Bluetooth konek: ${device.displayName}. Auto print siap digunakan.';
      });
      await _savePrinterSettings(showMessage: false);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _isBluetoothPrinterConnected = false;
        _connectedBluetoothTarget = null;
        _message =
            'Gagal konek ke printer ${device.displayName}. ${_readableError(error)}';
      });
      await _prefs?.setBool(_printerBluetoothConnectedKey, false);
    } finally {
      if (mounted) {
        setState(() => _isConnectingBluetoothPrinter = false);
      }
    }
  }

  Future<void> _disconnectBluetoothPrinter() async {
    setState(() {
      _printerConnection = 'bluetooth';
      _printerEnabled = false;
      _isBluetoothPrinterConnected = false;
      _connectedBluetoothTarget = null;
      _message =
          'Printer Bluetooth sudah diskonek. Tekan Konek lagi sebelum print.';
    });
    await _savePrinterSettings(showMessage: false);
  }

  Future<void> _syncPending() async {
    await _checkoutCubit.syncPending(api: _api, prefs: _prefs);
    final outlet = _selectedOutlet;
    if (outlet != null && _checkoutCubit.state.isOnline) {
      await _loadShiftAndCatalog(outlet);
      await _loadSalesReport(showErrors: false);
    }
  }

  void _maybeAutoSyncPending() {
    if (!_isSignedIn || !_isOnline || _pendingSyncCount <= 0) {
      return;
    }
    unawaited(_autoSyncPending());
  }

  Future<void> _autoSyncPending() async {
    if (_isAutoSyncRunning || !_isOnline || _pendingSyncCount <= 0) {
      return;
    }
    _isAutoSyncRunning = true;
    try {
      _showToast('Koneksi kembali online. Sync antrean offline...');
      await _syncPending();
    } finally {
      _isAutoSyncRunning = false;
    }
  }

  void _ensureRealtimeConnected() {
    if (!_isSignedIn || !_isOnline || _isRealtimeConnected) {
      return;
    }
    _realtimeReconnectTimer?.cancel();
    _realtimeSubscription?.cancel();
    _isRealtimeConnected = true;
    _realtimeSubscription = _api.realtimeEvents().listen(
      _handleRealtimeEvent,
      onError: (_) {
        _isRealtimeConnected = false;
        _scheduleRealtimeReconnect();
      },
      onDone: () {
        _isRealtimeConnected = false;
        _scheduleRealtimeReconnect();
      },
      cancelOnError: true,
    );
  }

  void _stopRealtime() {
    _realtimeReconnectTimer?.cancel();
    _realtimeRefreshTimer?.cancel();
    _realtimeSubscription?.cancel();
    _realtimeSubscription = null;
    _isRealtimeConnected = false;
    _realtimeReconnectAttempt = 0;
    _pendingRealtimeTopics.clear();
  }

  void _scheduleRealtimeReconnect() {
    if (!_isSignedIn || !_isOnline) {
      return;
    }
    _realtimeReconnectTimer?.cancel();
    final delaySeconds = min(30, pow(2, _realtimeReconnectAttempt).toInt());
    _realtimeReconnectAttempt = min(5, _realtimeReconnectAttempt + 1);
    _realtimeReconnectTimer = Timer(Duration(seconds: delaySeconds), () {
      _ensureRealtimeConnected();
    });
  }

  Future<void> _confirmLogout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => const _PosConfirmDialog(
        title: 'Keluar dari kasir?',
        message:
            'Pastikan transaksi selesai dan antrean offline sudah disinkronkan sebelum keluar.',
        confirmLabel: 'Ya, keluar',
        icon: Icons.logout,
        danger: true,
      ),
    );
    if (confirmed == true) {
      await _logout();
    }
  }

  void _handleRealtimeEvent(RealtimeEvent event) {
    _realtimeReconnectAttempt = 0;
    if (!_isRealtimeEventRelevant(event)) {
      return;
    }
    _pendingRealtimeTopics.addAll(event.topics);
    _realtimeRefreshTimer?.cancel();
    _realtimeRefreshTimer = Timer(const Duration(milliseconds: 700), () {
      unawaited(_refreshFromRealtime());
    });
  }

  bool _isRealtimeEventRelevant(RealtimeEvent event) {
    final outletId = event.outletId;
    if (outletId == null || outletId.isEmpty) {
      return true;
    }
    return outletId == _selectedOutlet?.id || outletId == _reportOutletId;
  }

  Future<void> _refreshFromRealtime() async {
    if (_isRealtimeRefreshRunning || _pendingRealtimeTopics.isEmpty) {
      return;
    }
    final topics = Set<String>.from(_pendingRealtimeTopics);
    _pendingRealtimeTopics.clear();
    _isRealtimeRefreshRunning = true;
    _isApplyingRealtimeRefresh = true;
    try {
      final outlet = _selectedOutlet;
      if (topics.any(
        (topic) => {
          'settings',
          'promotions',
          'masterData',
          'customers',
        }.contains(topic),
      )) {
        await _loadWorkspace(showErrors: false);
      } else if (topics.any(
        (topic) => {
          'inventory',
          'sales',
          'shift',
          'sync',
          'waste',
          'stockOpname',
          'purchases',
        }.contains(topic),
      )) {
        if (outlet != null) {
          await _loadShiftAndCatalog(outlet);
        }
        await _loadSalesReport(showErrors: false);
      }
    } finally {
      _isApplyingRealtimeRefresh = false;
      _isRealtimeRefreshRunning = false;
    }
  }

  Future<void> _saveBaseUrl() async {
    final value = _baseUrlController.text.trim();
    if (value.isEmpty) {
      return;
    }
    await _authCubit.saveBaseUrl(value);
    if (mounted) {
      Navigator.pop(context);
    }
  }

  Future<void> _runBusy(
    Future<void> Function() action, {
    String failurePrefix = 'Aksi gagal',
  }) async {
    setState(() {
      _isBusy = true;
      _message = '';
    });
    try {
      await action();
    } catch (error) {
      setState(() => _message = '$failurePrefix. ${_readableError(error)}');
    } finally {
      if (mounted) {
        setState(() => _isBusy = false);
      }
    }
  }

  void _queueToast(String message) {
    if (message.isEmpty || message == _lastToastMessage) {
      return;
    }
    _lastToastMessage = message;
    WidgetsBinding.instance.addPostFrameCallback((_) => _showToast(message));
  }

  void _showToast(String message) {
    if (!mounted || message.isEmpty) {
      return;
    }
    final messenger = ScaffoldMessenger.of(context);
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(
      SnackBar(
        content: Text(message),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    );
  }

  CartSession get _activeCartSession {
    return _cartSessions.firstWhere(
      (session) => session.id == _activeCartSessionId,
      orElse: () => _cartSessions.first,
    );
  }

  List<CartLine> get _cart => _activeCartSession.lines;

  void _newCartSession() {
    _cartCubit.newSession();
  }

  void _switchCartSession(String id) {
    _cartCubit.switchSession(id);
  }

  void _closeActiveCartSession() {
    _cartCubit.closeActiveSession();
  }

  void _addPaymentLine() {
    final controller = TextEditingController();
    controller.addListener(_resetIdleTimer);
    setState(() {
      final used = _paymentMethods.toSet();
      final method = paymentLabels.keys.firstWhere(
        (item) => !used.contains(item),
        orElse: () => 'cash',
      );
      _paymentMethods.add(method);
      _paymentAmountControllers.add(controller);
    });
  }

  void _removePaymentLine(int index) {
    if (_paymentMethods.length <= 1) {
      setState(() {
        _paymentMethods[0] = 'cash';
        _paymentAmountControllers[0].clear();
      });
      return;
    }
    final controller = _paymentAmountControllers.removeAt(index);
    setState(() {
      _paymentMethods.removeAt(index);
    });
    controller.removeListener(_resetIdleTimer);
    if (controller != _paidController) {
      controller.dispose();
    }
  }

  void _setPaymentMethod(int index, String method) {
    setState(() {
      _paymentMethods[index] = method;
    });
  }

  void _resetPaymentLines() {
    for (final controller in _paymentAmountControllers.skip(1)) {
      controller.removeListener(_resetIdleTimer);
      controller.dispose();
    }
    _paymentMethods
      ..clear()
      ..add('cash');
    _paymentAmountControllers
      ..clear()
      ..add(_paidController);
    _paidController.clear();
  }

  void _completeActiveCartSession() {
    _cartCubit.completeActiveSession();
  }

  SaleQuote? get _currentQuote {
    return _cartCubit.currentQuote(
          outlet: _selectedOutlet,
          customerId: _customerId,
          manualDiscount: _discount,
          manualTax: _manualTaxTotal,
          manualServiceCharge: _manualServiceChargeTotal,
          donation: _donationTotal,
          promotionCodes: _promotionCodes,
        ) ??
        _localSaleQuote;
  }

  SaleQuote? get _localSaleQuote {
    final outlet = _selectedOutlet;
    if (outlet == null || _cart.isEmpty) {
      return null;
    }
    final codes = _promotionCodes;
    if (codes.isNotEmpty && _promotions.isEmpty) {
      return null;
    }
    final subtotal = _subtotal;
    final manualDiscount = min(_discount, subtotal);
    final promotionResult = _calculateLocalPromotionDiscount(
      outlet: outlet,
      subtotal: subtotal,
      manualDiscount: manualDiscount,
      promotionCodes: codes,
    );
    final discountTotal = manualDiscount + promotionResult.discountTotal;
    final baseAfterDiscount = max(0, subtotal - discountTotal);
    final totalBeforeRounding = max(
      0,
      baseAfterDiscount +
          _manualTaxTotal +
          _manualServiceChargeTotal +
          _donationTotal,
    );
    final grandTotal = _roundToCashHundred(totalBeforeRounding);

    return SaleQuote(
      subtotal: subtotal,
      discountTotal: discountTotal,
      manualDiscountTotal: manualDiscount,
      promotionDiscountTotal: promotionResult.discountTotal,
      taxTotal: _manualTaxTotal,
      serviceChargeTotal: _manualServiceChargeTotal,
      donationTotal: _donationTotal,
      roundingTotal: grandTotal - totalBeforeRounding,
      grandTotal: grandTotal,
      appliedPromotions: promotionResult.appliedPromotions,
      promotionIssues: promotionResult.promotionIssues,
    );
  }

  void _scheduleSaleQuoteRefresh() {
    _quoteTimer?.cancel();
    _quoteTimer = Timer(
      const Duration(milliseconds: 350),
      () => _refreshSaleQuote(),
    );
  }

  Future<void> _refreshSaleQuote({bool showErrors = false}) async {
    await _cartCubit.refreshSaleQuote(
      api: _api,
      outlet: _selectedOutlet,
      customerId: _customerId,
      manualDiscount: _discount,
      manualTax: _manualTaxTotal,
      manualServiceCharge: _manualServiceChargeTotal,
      donation: _donationTotal,
      promotionCodes: _promotionCodes,
      showErrors: showErrors,
    );
    final issue = _cartCubit.state.saleQuote?.promotionIssues.firstOrNull;
    if (issue != null && _promotionCodes.isNotEmpty) {
      _queueToast(issue.message);
    }
  }

  _LocalPromotionResult _calculateLocalPromotionDiscount({
    required Outlet outlet,
    required double subtotal,
    required double manualDiscount,
    required List<String> promotionCodes,
  }) {
    final now = DateTime.now();
    final codes = promotionCodes
        .map((code) => code.trim().toUpperCase())
        .where((code) => code.isNotEmpty)
        .toSet();
    final appliedPromotions = <AppliedPromotion>[];
    final appliedCodes = <String>{};
    var discountTotal = 0.0;
    var remainingDiscountable = max(0, subtotal - manualDiscount);

    for (final promo in _promotions) {
      final promoCode = promo.code?.trim().toUpperCase() ?? '';
      if (!promo.isUsableNow(now)) continue;
      if (promoCode.isNotEmpty && !codes.contains(promoCode)) continue;
      if (!_localPromotionOutletMatches(promo, outlet.id)) continue;
      if (promo.minSubtotal > subtotal) continue;

      final discount = min(
        remainingDiscountable,
        _localPromotionDiscount(promo),
      ).toDouble();
      if (discount <= 0) continue;

      discountTotal += discount;
      remainingDiscountable -= discount;
      appliedPromotions.add(
        AppliedPromotion(
          name: promo.name,
          code: promo.code,
          discountTotal: discount,
        ),
      );
      if (promoCode.isNotEmpty) {
        appliedCodes.add(promoCode);
      }
      if (remainingDiscountable <= 0) break;
    }

    final issues = <PromotionIssue>[];
    for (final code in codes) {
      if (appliedCodes.contains(code)) continue;
      issues.add(
        _describeLocalPromotionIssue(
          code: code,
          outletId: outlet.id,
          subtotal: subtotal,
          now: now,
        ),
      );
    }

    return _LocalPromotionResult(
      discountTotal: discountTotal,
      appliedPromotions: appliedPromotions,
      promotionIssues: issues,
    );
  }

  double _localPromotionDiscount(PromotionRule promo) {
    final eligibleItems = _cart
        .where((line) => _localPromotionItemMatches(line, promo))
        .toList();
    final eligibleTotal = eligibleItems.fold<double>(
      0,
      (sum, line) => sum + line.lineTotal,
    );

    if (promo.type == 'buy_x_get_y') {
      return eligibleItems.fold<double>(0, (sum, line) {
        final cycleQty = promo.buyQty + promo.getQty;
        if (cycleQty <= 0) return sum;
        final freeQty = (line.quantity / cycleQty).floor() * promo.getQty;
        return sum + min(line.lineTotal, freeQty * line.unitPrice);
      });
    }

    if (promo.type == 'item_discount') {
      return promo.discountType == 'percent'
          ? eligibleTotal * (promo.discountValue / 100)
          : min(eligibleTotal, promo.discountValue);
    }

    final transactionBase = _cart.fold<double>(
      0,
      (sum, line) => sum + line.lineTotal,
    );
    return promo.discountType == 'percent'
        ? transactionBase * (promo.discountValue / 100)
        : min(transactionBase, promo.discountValue);
  }

  bool _localPromotionItemMatches(CartLine line, PromotionRule promo) {
    if (promo.scope == 'sku') {
      return line.item.skuId == promo.targetSkuId;
    }
    if (promo.scope == 'category') {
      return (line.item.category ?? '') == (promo.targetCategory ?? '');
    }
    return true;
  }

  bool _localPromotionOutletMatches(PromotionRule promo, String outletId) {
    return promo.outletIds.isEmpty || promo.outletIds.contains(outletId);
  }

  PromotionIssue _describeLocalPromotionIssue({
    required String code,
    required String outletId,
    required double subtotal,
    required DateTime now,
  }) {
    final promo = _promotions
        .where((item) => (item.code ?? '').trim().toUpperCase() == code)
        .firstOrNull;
    if (promo == null) {
      return PromotionIssue(
        code: code,
        reason: 'not_found',
        message: 'Kode promo $code tidak ditemukan di cache lokal.',
      );
    }
    if (!promo.isActive) {
      return PromotionIssue(
        code: code,
        reason: 'inactive',
        message: 'Promo ${promo.name} sedang nonaktif.',
      );
    }
    if (promo.startsAt != null && promo.startsAt!.isAfter(now)) {
      return PromotionIssue(
        code: code,
        reason: 'not_started',
        message: 'Promo ${promo.name} belum mulai.',
      );
    }
    if (promo.endsAt != null && promo.endsAt!.isBefore(now)) {
      return PromotionIssue(
        code: code,
        reason: 'expired',
        message: 'Promo ${promo.name} sudah berakhir.',
      );
    }
    if (!promo.hasQuota) {
      return PromotionIssue(
        code: code,
        reason: 'quota_exceeded',
        message: 'Kuota promo ${promo.name} sudah habis.',
      );
    }
    if (!_localPromotionOutletMatches(promo, outletId)) {
      return PromotionIssue(
        code: code,
        reason: 'outlet_mismatch',
        message: 'Promo ${promo.name} tidak berlaku untuk outlet ini.',
      );
    }
    if (promo.minSubtotal > subtotal) {
      return PromotionIssue(
        code: code,
        reason: 'minimum_subtotal',
        message:
            'Promo ${promo.name} minimal subtotal ${_money(promo.minSubtotal)}.',
      );
    }
    if (_localPromotionDiscount(promo) <= 0) {
      return PromotionIssue(
        code: code,
        reason: 'condition_not_met',
        message:
            'Syarat produk atau qty untuk promo ${promo.name} belum terpenuhi.',
      );
    }
    return PromotionIssue(
      code: code,
      reason: 'not_applied',
      message: 'Promo ${promo.name} belum bisa digunakan pada transaksi ini.',
    );
  }

  double get _subtotal => _cart.fold(0, (sum, line) => sum + line.lineTotal);
  double get _discount =>
      min(_parseNumber(_discountController.text), _subtotal);
  double get _manualTaxTotal => max(0, _parseNumber(_taxController.text));
  double get _manualServiceChargeTotal =>
      max(0, _parseNumber(_serviceChargeController.text));
  double get _donationTotal => max(0, _parseNumber(_donationController.text));
  String? get _receiptLogoUrl {
    final outletLogo = _selectedOutlet?.logoUrl?.trim();
    if (outletLogo != null && outletLogo.isNotEmpty) {
      return outletLogo;
    }
    final defaultLogo = _receiptLayout.logoUrl.trim();
    return defaultLogo.isEmpty ? null : defaultLogo;
  }

  List<String> get _promotionCodes =>
      _promotionCodeController.text.trim().isEmpty
      ? <String>[]
      : <String>[_promotionCodeController.text.trim().toUpperCase()];
  double get _taxTotal => _currentQuote?.taxTotal ?? _manualTaxTotal;
  double get _serviceChargeTotal =>
      _currentQuote?.serviceChargeTotal ?? _manualServiceChargeTotal;
  double get _roundingTotal =>
      _currentQuote?.roundingTotal ??
      _roundToCashHundred(_localTotalBeforeRounding) -
          _localTotalBeforeRounding;
  double get _displayDiscountTotal => _currentQuote?.discountTotal ?? _discount;
  double get _localTotalBeforeRounding => max(
    0,
    _subtotal -
        _discount +
        _manualTaxTotal +
        _manualServiceChargeTotal +
        _donationTotal,
  );
  double get _grandTotal =>
      _currentQuote?.grandTotal ??
      _roundToCashHundred(_localTotalBeforeRounding);
  List<SalesPayment> get _normalizedCartPayments {
    return List.generate(_paymentMethods.length, (index) {
      final typedAmount = _parseNumber(_paymentAmountControllers[index].text);
      final amount = _paymentMethods.length == 1 && typedAmount <= 0
          ? _grandTotal
          : typedAmount;
      return SalesPayment(method: _paymentMethods[index], amount: amount);
    }).where((payment) => payment.amount > 0).toList();
  }

  double get _paidTotal =>
      _normalizedCartPayments.fold(0, (sum, item) => sum + item.amount);
  double get _changeTotal => max(0, _paidTotal - _grandTotal);
  double get _cashTenderedTotal => _normalizedCartPayments
      .where((payment) => payment.method == 'cash')
      .fold(0, (sum, payment) => sum + payment.amount);
  double get _receivableTotal =>
      _normalizedCartPayments.any((payment) => payment.method == 'receivable')
      ? max(
          0,
          _grandTotal -
              _salePayments.fold(0.0, (sum, item) => sum + item.amount),
        )
      : 0;
  bool get _hasReceivablePayment => _paymentMethods.contains('receivable');
  List<SalesPayment> get _salePayments => _normalizedCartPayments
      .where((payment) => payment.method != 'receivable')
      .toList();
  double get _nonCashOverpaid {
    final nonCashTotal = _salePayments
        .where(
          (payment) =>
              payment.method != 'cash' && payment.method != 'receivable',
        )
        .fold(0.0, (sum, payment) => sum + payment.amount);
    return max(0, nonCashTotal - _grandTotal);
  }

  int get _pendingSyncCount => _pendingSales.length + _pendingWastes.length;

  int get _pendingSyncForSelectedOutlet {
    final outletId = _selectedOutlet?.id;
    if (outletId == null || outletId.isEmpty) {
      return _pendingSyncCount;
    }
    final sales = _pendingSales
        .where((sale) => sale['outletId']?.toString() == outletId)
        .length;
    final wastes = _pendingWastes
        .where((waste) => waste['outletId']?.toString() == outletId)
        .length;
    return sales + wastes;
  }

  List<CatalogItem> get _filteredCatalog {
    final keyword = _searchController.text.trim().toLowerCase();
    return _catalog.where((item) {
      final category = item.category?.isNotEmpty == true
          ? item.category!
          : 'Lainnya';
      final matchesCategory =
          _selectedCategory == 'Semua' || category == _selectedCategory;
      final matchesSearch =
          keyword.isEmpty ||
          item.productName.toLowerCase().contains(keyword) ||
          item.skuName.toLowerCase().contains(keyword) ||
          item.skuCode.toLowerCase().contains(keyword) ||
          (item.barcode ?? '').toLowerCase().contains(keyword) ||
          (item.category ?? '').toLowerCase().contains(keyword);
      return matchesCategory && matchesSearch;
    }).toList();
  }

  List<String> get _catalogCategories {
    final categories =
        _catalog
            .map(
              (item) => item.category?.isNotEmpty == true
                  ? item.category!
                  : 'Lainnya',
            )
            .toSet()
            .toList()
          ..sort();
    return ['Semua', ...categories];
  }

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider<AuthCubit>.value(value: _authCubit),
        BlocProvider<WorkspaceCubit>.value(value: _workspaceCubit),
        BlocProvider<CartCubit>.value(value: _cartCubit),
        BlocProvider<CheckoutCubit>.value(value: _checkoutCubit),
      ],
      child: MultiBlocListener(
        listeners: [
          BlocListener<AuthCubit, AuthState>(
            listener: (context, state) => _syncAuthState(state),
          ),
          BlocListener<WorkspaceCubit, WorkspaceState>(
            listener: (context, state) => _syncWorkspaceState(state),
          ),
          BlocListener<CartCubit, CartState>(
            listener: (context, state) => _syncCartState(state),
          ),
          BlocListener<CheckoutCubit, CheckoutState>(
            listener: (context, state) => _syncCheckoutState(state),
          ),
        ],
        child: BlocBuilder<AuthCubit, AuthState>(
          builder: (context, authState) {
            return BlocBuilder<WorkspaceCubit, WorkspaceState>(
              builder: (context, workspaceState) {
                return BlocBuilder<CartCubit, CartState>(
                  builder: (context, cartState) {
                    return BlocBuilder<CheckoutCubit, CheckoutState>(
                      builder: (context, checkoutState) => _buildShell(),
                    );
                  },
                );
              },
            );
          },
        ),
      ),
    );
  }

  Widget _buildShell() {
    if (_isBooting) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (!_isSignedIn) {
      return LoginView(
        emailController: _emailController,
        passwordController: _passwordController,
        baseUrlController: _baseUrlController,
        isBusy: _isBusy,
        message: _message,
        onSubmit: _signIn,
      );
    }

    _queueToast(_message);
    final width = MediaQuery.of(context).size.width;
    final isPhone = width < 720;
    final useRail = width >= 900;
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (_) => _resetIdleTimer(),
      onPointerMove: (_) => _resetIdleTimer(),
      onPointerSignal: (_) => _resetIdleTimer(),
      child: Scaffold(
        drawer: useRail ? null : _buildSidebarDrawer(),
        appBar: AppBar(
          leading: useRail
              ? null
              : Builder(
                  builder: (context) => IconButton(
                    tooltip: 'Menu',
                    onPressed: () => Scaffold.of(context).openDrawer(),
                    icon: const Icon(Icons.menu),
                  ),
                ),
          titleSpacing: 16,
          title: _HeaderTitle(
            title: _selectedTab == 0 ? 'Kasir' : 'Laporan Penjualan',
            outletName: _selectedOutlet?.name ?? 'Pilih outlet',
            shiftOpen: _activeShift != null,
          ),
          actions: [
            if (isPhone)
              _StatusIcon(online: _isOnline, pendingCount: _pendingSyncCount)
            else
              _StatusPill(online: _isOnline, pendingCount: _pendingSyncCount),
            IconButton(
              tooltip: 'Printer',
              onPressed: _showPrinterSettingsSheet,
              icon: Icon(
                _isBluetoothPrinterConnected
                    ? Icons.print
                    : Icons.print_outlined,
              ),
            ),
            IconButton(
              tooltip: 'Outlet & Shift',
              onPressed: _showShiftSheet,
              icon: const Icon(Icons.account_balance_wallet_outlined),
            ),
            IconButton(
              tooltip: 'Profil',
              onPressed: _showProfileSheet,
              icon: const Icon(Icons.person_outline),
            ),
            const SizedBox(width: 8),
          ],
        ),
        body: Column(
          children: [
            const SubscriptionStatusBar(),
            if (_isBusy || _isReportLoading)
              const LinearProgressIndicator(minHeight: 3),
            if (_activeShift != null)
              _CashInfoBanner(expectedCash: _activeShift!.expectedCash),
            Expanded(
              child: Row(
                children: [
                  if (useRail) _buildNavigationRail(),
                  Expanded(
                    child: _selectedTab == 0
                        ? _buildPosBody()
                        : _buildReportBody(),
                  ),
                ],
              ),
            ),
          ],
        ),
        floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
        floatingActionButton: _selectedTab == 0 && isPhone
            ? _FloatingCartButton(
                count: _cart.length,
                total: _grandTotal,
                onPressed: _showCartSheet,
              )
            : null,
        bottomNavigationBar: useRail ? null : _buildBottomNavigation(),
      ),
    );
  }

  Widget _buildNavigationRail() {
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: AppPalette.white,
        border: Border(right: BorderSide(color: AppPalette.line)),
      ),
      child: NavigationRail(
        selectedIndex: _selectedTab,
        minWidth: 82,
        groupAlignment: -0.78,
        labelType: NavigationRailLabelType.all,
        onDestinationSelected: _selectTab,
        leading: Padding(
          padding: const EdgeInsets.only(top: 10, bottom: 16),
          child: Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppPalette.navy,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.point_of_sale, color: AppPalette.white),
          ),
        ),
        destinations: const [
          NavigationRailDestination(
            icon: Icon(Icons.point_of_sale_outlined),
            selectedIcon: Icon(Icons.point_of_sale),
            label: Text('Kasir'),
          ),
          NavigationRailDestination(
            icon: Icon(Icons.bar_chart_outlined),
            selectedIcon: Icon(Icons.bar_chart),
            label: Text('Laporan'),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomNavigation() {
    return NavigationBar(
      selectedIndex: _selectedTab,
      onDestinationSelected: _selectTab,
      destinations: const [
        NavigationDestination(
          icon: Icon(Icons.point_of_sale_outlined),
          selectedIcon: Icon(Icons.point_of_sale),
          label: 'Kasir',
        ),
        NavigationDestination(
          icon: Icon(Icons.bar_chart_outlined),
          selectedIcon: Icon(Icons.bar_chart),
          label: 'Laporan',
        ),
      ],
    );
  }

  Future<void> _selectTab(int index) async {
    setState(() => _selectedTab = index);
    if (index == 1) {
      await _loadSalesReport(showErrors: false);
    }
  }

  Widget _buildPosBody() {
    final products = _ProductPane(
      searchController: _searchController,
      items: _filteredCatalog,
      isLoading: _isCatalogLoading,
      categories: _catalogCategories,
      selectedCategory: _selectedCategory,
      onCategoryChanged: (value) => setState(() => _selectedCategory = value),
      onSearchChanged: () => setState(() {}),
      onAdd: _addToCart,
      apiBaseUrl: _api.baseUrl,
    );
    final cart = _buildCartPane();

    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final isWide = width >= 980;
        final isTablet = width >= 720;

        Widget content;
        if (isWide) {
          content = Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(flex: 7, child: Column(children: [Expanded(child: products)])),
                const SizedBox(width: 12),
                SizedBox(width: 420, child: cart),
              ],
            ),
          );
        } else {
          content = Padding(
            padding: EdgeInsets.fromLTRB(10, 10, 10, isTablet ? 10 : 96),
            child: Column(
              children: [
                Expanded(child: products),
                if (isTablet) ...[const SizedBox(height: 10), SizedBox(height: 420, child: cart)],
              ],
            ),
          );
        }

        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 8, 14, 4),
              child: ShiftIndicator(
                isShiftOpen: _activeShift != null,
                expectedCash: _activeShift?.expectedCash ?? 0,
                onOpen: _activeShift == null && !_isBusy ? _openShift : null,
                onClose: _activeShift != null && !_isBusy ? _closeShift : null,
                isBusy: _isBusy,
              ),
            ),
            Expanded(child: content),
          ],
        );
      },
    );
  }

  Widget _buildCartPane({
    VoidCallback? afterCartChanged,
    VoidCallback? afterCheckout,
  }) {
    return _CartPane(
      lines: _cart,
      sessions: _cartSessions,
      activeSessionId: _activeCartSessionId,
      subtotal: _subtotal,
      discountTotal: _displayDiscountTotal,
      donationTotal: _donationTotal,
      roundingTotal: _roundingTotal,
      grandTotal: _grandTotal,
      isQuoteLoading: _isQuoteLoading,
      promotionCodeController: _promotionCodeController,
      paymentMethods: _paymentMethods,
      paymentAmountControllers: _paymentAmountControllers,
      paidTotal: _paidTotal,
      changeTotal: _changeTotal,
      pendingCount: _pendingSyncCount,
      onPaymentMethodChanged: (index, value) => _setPaymentMethod(index, value),
      onPaymentAmountChanged: () {
        setState(() {});
        afterCartChanged?.call();
      },
      onPromotionChanged: () {
        _scheduleSaleQuoteRefresh();
        setState(() {});
        afterCartChanged?.call();
      },
      onAddPayment: _addPaymentLine,
      onRemovePayment: _removePaymentLine,
      onSessionChanged: (id) {
        _switchCartSession(id);
        afterCartChanged?.call();
      },
      onNewSession: () {
        _newCartSession();
        afterCartChanged?.call();
      },
      onCloseSession: () {
        _closeActiveCartSession();
        afterCartChanged?.call();
      },
      onQuantityChanged: (line, quantity) {
        _changeCartQuantity(line, quantity);
        afterCartChanged?.call();
      },
      onUnitChanged: (line, unit) {
        _changeCartUnit(line, unit);
        afterCartChanged?.call();
      },
      onEditQuantity: _editQuantity,
      onCheckout: _isBusy
          ? null
          : () async {
              final cartCountBefore = _cart.length;
              await _openPaymentSheet();
              if (_cart.isEmpty || _cart.length < cartCountBefore) {
                afterCheckout?.call();
              }
            },
    );
  }

  Widget _buildReportBody() {
    return _SalesReportPane(
      report: _salesReport,
      details: _salesDetails,
      shiftSummary: _shiftSummary,
      selectedRange: _reportRange,
      isLoading: _isReportLoading,
      outlets: _outlets,
      selectedOutletId: _reportOutletId ?? _selectedOutlet?.id,
      canViewAllOutlets: _canViewAllOutletReports,
      onRangeChanged: _changeReportRange,
      onOutletChanged: _changeReportOutlet,
      onRefresh: () => _loadSalesReport(),
      onVoid: _voidSale,
      onRefund: _refundSale,
      onReprint: (detail) => _printReceipt(
        ReceiptData.fromSalesDetail(
          detail,
          outletName: _selectedOutlet?.name ?? 'Outlet',
          outletAddress: _selectedOutlet?.address ?? '',
        ),
      ),
    );
  }

  Future<void> _voidSale(SalesDetail detail) async {
    final reason = await _requestSaleCorrectionReason(
      title: 'Void transaksi',
      confirmLabel: 'Void',
    );
    if (reason == null) return;
    await _runBusy(() async {
      await _api.voidSale(saleId: detail.id, reason: reason);
      _showToast('Transaksi ${detail.receiptNumber} berhasil divoid.');
      await _loadSalesReport(showErrors: false);
      final outlet = _selectedOutlet;
      if (outlet != null) await _loadShiftAndCatalog(outlet);
    }, failurePrefix: 'Void transaksi gagal');
  }

  Future<void> _refundSale(SalesDetail detail) async {
    final result = await _requestRefundInput();
    if (result == null) return;
    await _runBusy(() async {
      await _api.refundSale(
        saleId: detail.id,
        reason: result.$1,
        restock: result.$2,
        refundMethod: result.$3,
      );
      _showToast('Transaksi ${detail.receiptNumber} berhasil direfund.');
      await _loadSalesReport(showErrors: false);
      final outlet = _selectedOutlet;
      if (outlet != null) await _loadShiftAndCatalog(outlet);
    }, failurePrefix: 'Refund transaksi gagal');
  }

  Future<String?> _requestSaleCorrectionReason({
    required String title,
    required String confirmLabel,
  }) async {
    final controller = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: controller,
          autofocus: true,
          minLines: 3,
          maxLines: 4,
          decoration: const InputDecoration(labelText: 'Alasan'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () {
              final value = controller.text.trim();
              if (value.length < 3) return;
              Navigator.pop(context, value);
            },
            child: Text(confirmLabel),
          ),
        ],
      ),
    );
    controller.dispose();
    return result;
  }

  Future<(String, bool, String?)?> _requestRefundInput() async {
    final controller = TextEditingController();
    var restock = true;
    var refundMethod = 'cash';
    final result = await showDialog<(String, bool, String?)>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Refund transaksi'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: controller,
                autofocus: true,
                minLines: 3,
                maxLines: 4,
                decoration: const InputDecoration(labelText: 'Alasan'),
              ),
              const SizedBox(height: 12),
              CheckboxListTile(
                value: restock,
                onChanged: (value) =>
                    setDialogState(() => restock = value ?? true),
                title: const Text('Kembalikan stok'),
                contentPadding: EdgeInsets.zero,
              ),
              DropdownButtonFormField<String>(
                initialValue: refundMethod,
                decoration: const InputDecoration(labelText: 'Metode refund'),
                items: paymentLabels.entries
                    .where((entry) => entry.key != 'receivable')
                    .map(
                      (entry) => DropdownMenuItem(
                        value: entry.key,
                        child: Text(entry.value),
                      ),
                    )
                    .toList(),
                onChanged: (value) {
                  if (value != null) {
                    setDialogState(() => refundMethod = value);
                  }
                },
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Batal'),
            ),
            FilledButton(
              onPressed: () {
                final value = controller.text.trim();
                if (value.length < 3) return;
                Navigator.pop(context, (value, restock, refundMethod));
              },
              child: const Text('Refund'),
            ),
          ],
        ),
      ),
    );
    controller.dispose();
    return result;
  }

  Widget _buildPrinterSettingsCard({VoidCallback? afterChanged}) {
    return PrinterSettingsCard(
      enabled: _printerEnabled,
      connection: _printerConnection,
      bluetoothController: _printerBluetoothController,
      bluetoothDevices: _bluetoothPrinters,
      isLoadingBluetoothDevices: _isLoadingBluetoothPrinters,
      isBluetoothConnected: _isBluetoothPrinterConnected,
      isConnectingBluetoothDevice: _isConnectingBluetoothPrinter,
      isPrintingReceipt: _isPrintingReceipt,
      connectedBluetoothTarget: _connectedBluetoothTarget,
      paperWidth: _receiptLayout.paperWidth,
      autoPrintFromDashboard: _receiptLayout.autoPrint,
      onEnabledChanged: (value) {
        setState(() => _printerEnabled = value);
        afterChanged?.call();
      },
      onRefreshBluetoothDevices: () {
        unawaited(_loadBluetoothPrinters().then((_) => afterChanged?.call()));
      },
      onConnectBluetoothDevice: (device) {
        unawaited(
          _connectBluetoothPrinter(device).then((_) => afterChanged?.call()),
        );
      },
      onDisconnectBluetoothDevice: () {
        unawaited(
          _disconnectBluetoothPrinter().then((_) => afterChanged?.call()),
        );
      },
      onSave: () {
        unawaited(_savePrinterSettings().then((_) => afterChanged?.call()));
      },
      onTestPrint: () {
        unawaited(
          _printReceipt(ReceiptData.sample()).then((_) => afterChanged?.call()),
        );
      },
    );
  }

  Widget _buildSidebarDrawer() {
    return Drawer(
      width: min(MediaQuery.of(context).size.width * 0.9, 420),
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(18),
              color: AppPalette.navy,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'POS ERP',
                    style: TextStyle(
                      color: AppPalette.aqua,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _currentUser?.name ?? 'Kasir',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppPalette.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _selectedOutlet?.name ?? 'Belum pilih outlet',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: AppPalette.ivory),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(14),
                children: [
                  _SidebarGroup(
                    title: 'Navigasi',
                    children: [
                      _SidebarTile(
                        icon: Icons.point_of_sale_outlined,
                        title: 'Kasir',
                        selected: _selectedTab == 0,
                        onTap: () {
                          Navigator.pop(context);
                          setState(() => _selectedTab = 0);
                        },
                      ),
                      _SidebarTile(
                        icon: Icons.bar_chart_outlined,
                        title: 'Laporan Penjualan',
                        selected: _selectedTab == 1,
                        onTap: () async {
                          Navigator.pop(context);
                          setState(() => _selectedTab = 1);
                          await _loadSalesReport(showErrors: false);
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _WorkspaceBar(
                    outlets: _outlets,
                    selectedOutlet: _selectedOutlet,
                    activeShift: _activeShift,
                    openingCashController: _openingCashController,
                    actualCashController: _actualCashController,
                    onSelectOutlet: _selectOutlet,
                    onOpenShift: _isBusy ? null : _openShift,
                    onCloseShift: _isBusy ? null : _closeShift,
                  ),
                  const SizedBox(height: 12),
                  _buildPrinterSettingsCard(),
                  const SizedBox(height: 12),
                  _SidebarGroup(
                    title: 'Tools',
                    children: [
                      _SidebarTile(
                        icon: Icons.sync,
                        title: 'Sync data offline',
                        subtitle:
                            '${_pendingSales.length} transaksi, ${_pendingWastes.length} remahan',
                        onTap: _isBusy
                            ? null
                            : () {
                                Navigator.pop(context);
                                _syncPending();
                              },
                      ),
                      _SidebarTile(
                        icon: Icons.refresh,
                        title: 'Refresh data',
                        subtitle: 'Outlet, katalog, dan laporan',
                        onTap: _isBusy
                            ? null
                            : () async {
                                Navigator.pop(context);
                                await _loadWorkspace();
                                await _loadSalesReport(showErrors: false);
                              },
                      ),
                      _SidebarTile(
                        icon: Icons.remove_shopping_cart_outlined,
                        title: 'Input remahan',
                        subtitle: 'Stok tidak dapat dijual',
                        onTap: _isBusy
                            ? null
                            : () {
                                Navigator.pop(context);
                                _showWasteSheet();
                              },
                      ),
                      _SidebarTile(
                        icon: Icons.dns_outlined,
                        title: 'Server API',
                        subtitle: _api.baseUrl,
                        onTap: () {
                          Navigator.pop(context);
                          _showServerDialog();
                        },
                      ),
                      _SidebarTile(
                        icon: Icons.person_outline,
                        title: 'Profil kasir',
                        subtitle: _currentUser?.email ?? '',
                        onTap: () {
                          Navigator.pop(context);
                          _showProfileSheet();
                        },
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 8, 14, 14),
              child: FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: AppPalette.red,
                  foregroundColor: AppPalette.white,
                  minimumSize: const Size.fromHeight(46),
                ),
                onPressed: () {
                  Navigator.pop(context);
                  unawaited(_confirmLogout());
                },
                icon: const Icon(Icons.logout),
                label: const Text('Keluar'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showShiftSheet() {
    if (_activeShift != null) {
      unawaited(_refreshShiftSummary());
    }
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      showDragHandle: false,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) {
          final media = MediaQuery.of(context);
          return SafeArea(
            child: Padding(
              padding: EdgeInsets.fromLTRB(
                12,
                0,
                12,
                media.viewInsets.bottom + 16,
              ),
              child: Container(
                constraints: BoxConstraints(maxHeight: media.size.height * 0.9),
                decoration: BoxDecoration(
                  color: AppPalette.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppPalette.line),
                  boxShadow: [
                    BoxShadow(
                      color: AppPalette.navy.withValues(alpha: 0.18),
                      blurRadius: 28,
                      offset: const Offset(0, 14),
                    ),
                  ],
                ),
                padding: const EdgeInsets.all(16),
                child: SingleChildScrollView(
                  child: _ShiftSheetContent(
                    outlets: _outlets,
                    selectedOutlet: _selectedOutlet,
                    shift: _activeShift,
                    summary: _shiftSummary,
                    pendingVarianceShifts: _pendingVarianceShifts,
                    openingCashController: _openingCashController,
                    actualCashController: _actualCashController,
                    cashMovementType: _cashMovementType,
                    amountController: _cashMovementAmountController,
                    reasonController: _cashMovementReasonController,
                    noteController: _cashMovementNoteController,
                    isBusy: _isBusy,
                    onSelectOutlet: (value) async {
                      await _selectOutlet(value);
                      if (context.mounted) setSheetState(() {});
                    },
                    onOpenShift: _isBusy
                        ? null
                        : () async {
                            await _openShift();
                            if (context.mounted) setSheetState(() {});
                          },
                    onCloseShift: _isBusy
                        ? null
                        : () async {
                            await _closeShift();
                            if (context.mounted) setSheetState(() {});
                          },
                    onTypeChanged: (value) {
                      setState(() => _cashMovementType = value);
                      setSheetState(() {});
                    },
                    onSaveCashMovement: () async {
                      await _saveCashMovement();
                      if (context.mounted) setSheetState(() {});
                    },
                    onRefreshSummary: () async {
                      await _refreshShiftSummary();
                      await _loadPendingVarianceShifts(showErrors: false);
                      if (context.mounted) setSheetState(() {});
                    },
                    onApproveVariance: (item) async {
                      await _approveShiftVariance(item);
                      if (context.mounted) setSheetState(() {});
                    },
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  void _showCartSheet() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) {
          final media = MediaQuery.of(context);
          final availableHeight = media.size.height - media.viewInsets.bottom;
          return SafeArea(
            child: Padding(
              padding: EdgeInsets.fromLTRB(
                12,
                0,
                12,
                media.viewInsets.bottom + 12,
              ),
              child: SizedBox(
                height: min(availableHeight * 0.88, 700),
                child: _buildCartPane(
                  afterCartChanged: () => setSheetState(() {}),
                  afterCheckout: () {
                    if (Navigator.canPop(context)) {
                      Navigator.pop(context);
                    }
                  },
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  void _showPrinterSettingsSheet() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) {
          final media = MediaQuery.of(context);
          return SafeArea(
            child: Padding(
              padding: EdgeInsets.fromLTRB(
                12,
                0,
                12,
                media.viewInsets.bottom + 12,
              ),
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  maxHeight: media.size.height * 0.86,
                  maxWidth: 520,
                ),
                child: SingleChildScrollView(
                  child: _buildPrinterSettingsCard(
                    afterChanged: () {
                      if (context.mounted) {
                        setSheetState(() {});
                      }
                    },
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  void _showProfileSheet() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: EdgeInsets.only(
            left: 14,
            right: 14,
            bottom: MediaQuery.of(context).viewInsets.bottom + 14,
          ),
          child: SingleChildScrollView(
            child: _UserSettingsCard(
              user: _currentUser,
              nameController: _cashierNameController,
              currentPasswordController: _currentPasswordController,
              newPasswordController: _newPasswordController,
              confirmPasswordController: _confirmPasswordController,
              onSave: _isBusy ? null : _saveUserSettings,
            ),
          ),
        ),
      ),
    );
  }

  void _showServerDialog() {
    showDialog<void>(
      context: context,
      builder: (context) => Dialog(
        insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 430),
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const _DialogTitle(
                  title: 'Server API',
                  subtitle: 'Ubah alamat backend untuk koneksi kasir mobile.',
                  icon: Icons.dns_outlined,
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _baseUrlController,
                  decoration: const InputDecoration(
                    labelText: 'Base URL',
                    prefixIcon: Icon(Icons.link),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(context),
                        child: const Text('Batal'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: _saveBaseUrl,
                        icon: const Icon(Icons.save_outlined),
                        label: const Text('Simpan'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
