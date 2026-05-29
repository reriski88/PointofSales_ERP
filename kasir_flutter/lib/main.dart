import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class AppPalette {
  static const red = Color(0xFFE63946);
  static const ivory = Color(0xFFF1FAEE);
  static const aqua = Color(0xFFA8DADC);
  static const blue = Color(0xFF457B9D);
  static const navy = Color(0xFF1D3557);
  static const line = Color(0xFFD4E6E7);
  static const white = Colors.white;
}

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

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'POS Cemilan Kasir',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: AppPalette.blue,
          primary: AppPalette.blue,
          secondary: AppPalette.aqua,
          tertiary: AppPalette.red,
          surface: AppPalette.ivory,
          error: AppPalette.red,
        ),
        scaffoldBackgroundColor: AppPalette.ivory,
        appBarTheme: const AppBarTheme(
          backgroundColor: AppPalette.navy,
          foregroundColor: AppPalette.white,
          elevation: 0,
          centerTitle: false,
        ),
        navigationBarTheme: NavigationBarThemeData(
          backgroundColor: AppPalette.white,
          indicatorColor: AppPalette.aqua,
          labelTextStyle: WidgetStateProperty.all(
            const TextStyle(fontWeight: FontWeight.w700),
          ),
        ),
        cardTheme: const CardThemeData(
          elevation: 0,
          color: AppPalette.white,
          margin: EdgeInsets.zero,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.all(Radius.circular(8)),
            side: BorderSide(color: AppPalette.line),
          ),
        ),
        inputDecorationTheme: const InputDecorationTheme(
          border: OutlineInputBorder(
            borderRadius: BorderRadius.all(Radius.circular(8)),
          ),
          isDense: true,
        ),
      ),
      home: const PosShell(),
    );
  }
}

class PosShell extends StatefulWidget {
  const PosShell({super.key});

  @override
  State<PosShell> createState() => _PosShellState();
}

class _PosShellState extends State<PosShell> {
  static const _defaultBaseUrl = 'http://localhost:3000';
  static const _baseUrlKey = 'base_url';
  static const _cookieKey = 'auth_cookie';
  static const _bearerKey = 'auth_bearer';
  static const _pendingKey = 'pending_sales';
  static const _catalogKey = 'cached_catalog';
  static const _outletsKey = 'cached_outlets';
  static const _selectedOutletKey = 'selected_outlet_id';
  static const _printerEnabledKey = 'printer_enabled';
  static const _printerConnectionKey = 'printer_connection';
  static const _printerHostKey = 'printer_host';
  static const _printerPortKey = 'printer_port';
  static const _printerBluetoothAddressKey = 'printer_bluetooth_address';
  static const _receiptLayoutKey = 'receipt_layout';
  static const _allOutletsReportId = '__all_outlets__';
  static const _idleLogoutDuration = Duration(minutes: 15);
  static const _printerChannel = MethodChannel('pos_cemilan/printer');

  final _emailController = TextEditingController(text: 'admin@email.com');
  final _passwordController = TextEditingController();
  final _baseUrlController = TextEditingController(text: _defaultBaseUrl);
  final _searchController = TextEditingController();
  final _openingCashController = TextEditingController(text: '0');
  final _actualCashController = TextEditingController();
  final _discountController = TextEditingController(text: '0');
  final _paidController = TextEditingController();
  final _cashierNameController = TextEditingController();
  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _wasteQtyController = TextEditingController();
  final _wasteNoteController = TextEditingController();
  final _printerHostController = TextEditingController();
  final _printerPortController = TextEditingController(text: '9100');
  final _printerBluetoothController = TextEditingController();

  late PosApi _api;
  SharedPreferences? _prefs;
  Timer? _idleTimer;

  var _isBooting = true;
  var _isBusy = false;
  var _isSignedIn = false;
  var _isOnline = false;
  var _selectedTab = 0;
  var _reportRange = ReportRange.today;
  var _canViewAllOutletReports = false;
  var _isReportLoading = false;
  var _isCatalogLoading = false;
  var _message = '';
  var _paymentMethod = 'cash';
  var _selectedCategory = 'Semua';
  var _wasteReason = 'crumbs_unsellable';
  var _lastToastMessage = '';
  var _printerEnabled = false;
  var _printerConnection = 'ip';
  var _isLoadingBluetoothPrinters = false;
  String? _wasteSkuId;
  String _activeCartSessionId = 'main';

  CurrentUser? _currentUser;
  List<Outlet> _outlets = [];
  Outlet? _selectedOutlet;
  String? _reportOutletId;
  Shift? _activeShift;
  SalesReport? _salesReport;
  List<SalesDetail> _salesDetails = [];
  List<CatalogItem> _catalog = [];
  List<CartSession> _cartSessions = [CartSession.empty('main', 'Pelanggan 1')];
  List<Map<String, dynamic>> _pendingSales = [];
  List<BluetoothPrinterDevice> _bluetoothPrinters = [];
  ReceiptLayout _receiptLayout = ReceiptLayout.defaultLayout();

  @override
  void initState() {
    super.initState();
    _api = PosApi(baseUrl: _defaultBaseUrl);
    for (final controller in _activityControllers) {
      controller.addListener(_resetIdleTimer);
    }
    _bootstrap();
  }

  @override
  void dispose() {
    _idleTimer?.cancel();
    for (final controller in _activityControllers) {
      controller.removeListener(_resetIdleTimer);
    }
    _emailController.dispose();
    _passwordController.dispose();
    _baseUrlController.dispose();
    _searchController.dispose();
    _openingCashController.dispose();
    _actualCashController.dispose();
    _discountController.dispose();
    _paidController.dispose();
    _cashierNameController.dispose();
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    _wasteQtyController.dispose();
    _wasteNoteController.dispose();
    _printerHostController.dispose();
    _printerPortController.dispose();
    _printerBluetoothController.dispose();
    super.dispose();
  }

  List<TextEditingController> get _activityControllers => [
    _searchController,
    _openingCashController,
    _actualCashController,
    _discountController,
    _paidController,
    _cashierNameController,
    _currentPasswordController,
    _newPasswordController,
    _confirmPasswordController,
    _wasteQtyController,
    _wasteNoteController,
    _printerHostController,
    _printerPortController,
    _printerBluetoothController,
  ];

  Future<void> _bootstrap() async {
    final prefs = await SharedPreferences.getInstance();
    final baseUrl = prefs.getString(_baseUrlKey) ?? _defaultBaseUrl;
    final cookie = prefs.getString(_cookieKey) ?? '';
    final bearer = prefs.getString(_bearerKey) ?? '';
    final printerHost = prefs.getString(_printerHostKey) ?? '';
    final printerPort = prefs.getInt(_printerPortKey) ?? 9100;
    final printerBluetooth = prefs.getString(_printerBluetoothAddressKey) ?? '';
    final receiptLayoutJson = prefs.getString(_receiptLayoutKey);
    _baseUrlController.text = baseUrl;
    _printerHostController.text = printerHost;
    _printerPortController.text = printerPort.toString();
    _printerBluetoothController.text = printerBluetooth;
    _api = PosApi(baseUrl: baseUrl, cookie: cookie, bearer: bearer);

    final cachedOutlets = _decodeList(prefs.getString(_outletsKey));
    final cachedCatalog = _decodeList(prefs.getString(_catalogKey));
    final selectedOutletId = prefs.getString(_selectedOutletKey);
    final cachedOutletModels = cachedOutlets
        .map(Outlet.fromJson)
        .where((outlet) => outlet.isActive)
        .toList();

    setState(() {
      _prefs = prefs;
      _pendingSales = _decodeList(prefs.getString(_pendingKey));
      _outlets = cachedOutletModels;
      _selectedOutlet = _pickOutlet(cachedOutletModels, selectedOutletId);
      _reportOutletId = selectedOutletId;
      _catalog = cachedCatalog.map(CatalogItem.fromJson).toList();
      _isSignedIn = cookie.isNotEmpty || bearer.isNotEmpty;
      _printerEnabled = prefs.getBool(_printerEnabledKey) ?? false;
      _printerConnection = prefs.getString(_printerConnectionKey) ?? 'ip';
      _receiptLayout = ReceiptLayout.fromCache(receiptLayoutJson);
    });

    await _refreshBaseUrlFromDatabase(showMessage: false);

    if (_isSignedIn) {
      _resetIdleTimer();
      await _loadProfile(showErrors: false);
      await _loadWorkspace(showErrors: false);
    }

    if (mounted) {
      setState(() => _isBooting = false);
    }
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

  Future<void> _savePendingSales() async {
    await _prefs?.setString(_pendingKey, jsonEncode(_pendingSales));
  }

  Future<void> _saveCatalog() async {
    await _prefs?.setString(
      _catalogKey,
      jsonEncode(_catalog.map((item) => item.toJson()).toList()),
    );
  }

  Future<void> _saveOutlets() async {
    await _prefs?.setString(
      _outletsKey,
      jsonEncode(_outlets.map((item) => item.toJson()).toList()),
    );
  }

  Future<void> _signIn() async {
    await _runBusy(() async {
      _api = PosApi(baseUrl: _baseUrlController.text.trim());
      await _refreshBaseUrlFromDatabase(showMessage: false);
      await _api.signIn(_emailController.text.trim(), _passwordController.text);
      await _prefs?.setString(_baseUrlKey, _api.baseUrl);
      await _prefs?.setString(_cookieKey, _api.cookie);
      await _prefs?.setString(_bearerKey, _api.bearer);
      setState(() {
        _isSignedIn = true;
        _isOnline = true;
        _message = 'Login berhasil.';
      });
      _resetIdleTimer();
      await _loadProfile();
      await _loadWorkspace();
    }, failurePrefix: 'Login gagal');
  }

  Future<bool> _refreshBaseUrlFromDatabase({bool showMessage = true}) async {
    try {
      final publicApiUrl = await _api.fetchPublicApiUrl();
      if (publicApiUrl == null || publicApiUrl == _api.baseUrl) {
        return false;
      }

      _api = PosApi(
        baseUrl: publicApiUrl,
        cookie: _api.cookie,
        bearer: _api.bearer,
      );
      _baseUrlController.text = _api.baseUrl;
      await _prefs?.setString(_baseUrlKey, _api.baseUrl);

      if (mounted && showMessage) {
        setState(() => _message = 'Server API diperbarui dari database.');
      }
      return true;
    } catch (error) {
      if (mounted && showMessage) {
        setState(
          () => _message =
              'URL publik belum bisa diambil dari database. ${_readableError(error)}',
        );
      }
      return false;
    }
  }

  Future<void> _logout({String message = 'Sesi kasir keluar.'}) async {
    _idleTimer?.cancel();
    await _prefs?.remove(_cookieKey);
    await _prefs?.remove(_bearerKey);
    setState(() {
      _isSignedIn = false;
      _isOnline = false;
      _activeShift = null;
      _currentUser = null;
      _cartSessions = [CartSession.empty('main', 'Pelanggan 1')];
      _activeCartSessionId = 'main';
      _message = message;
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

  Future<void> _loadProfile({bool showErrors = true}) async {
    try {
      final profile = await _api.fetchProfile();
      setState(() {
        _currentUser = profile;
        _cashierNameController.text = profile.name;
        _isOnline = true;
      });
    } catch (error) {
      setState(() {
        _isOnline = _serverReachableAfter(error);
        if (showErrors) {
          _message = 'Profil kasir belum bisa dimuat. ${_readableError(error)}';
        }
      });
    }
  }

  Future<void> _saveUserSettings() async {
    final name = _cashierNameController.text.trim();
    final currentPassword = _currentPasswordController.text;
    final newPassword = _newPasswordController.text;
    final confirmPassword = _confirmPasswordController.text;

    if (name.isEmpty) {
      setState(() => _message = 'Nama kasir wajib diisi.');
      return;
    }
    if (newPassword.isNotEmpty) {
      if (newPassword.length < 8) {
        setState(() => _message = 'Password baru minimal 8 karakter.');
        return;
      }
      if (currentPassword.isEmpty) {
        setState(() => _message = 'Password lama wajib diisi.');
        return;
      }
      if (newPassword != confirmPassword) {
        setState(() => _message = 'Konfirmasi password baru tidak sama.');
        return;
      }
    }

    await _runBusy(() async {
      final updated = await _api.updateProfile(name);
      if (newPassword.isNotEmpty) {
        await _api.changePassword(
          currentPassword: currentPassword,
          newPassword: newPassword,
        );
        await _prefs?.setString(_cookieKey, _api.cookie);
        await _prefs?.setString(_bearerKey, _api.bearer);
      }
      setState(() {
        _currentUser = updated;
        _cashierNameController.text = updated.name;
        _currentPasswordController.clear();
        _newPasswordController.clear();
        _confirmPasswordController.clear();
        _message = newPassword.isNotEmpty
            ? 'Nama dan password kasir berhasil diperbarui.'
            : 'Nama kasir berhasil diperbarui.';
      });
    }, failurePrefix: 'Update setting user gagal');
  }

  Future<void> _loadWorkspace({bool showErrors = true}) async {
    try {
      final allOutlets = await _api.listOutlets();
      final canViewAll = await _canFetchAllOutletReport();
      final receiptLayout = await _api.fetchReceiptLayout();
      final activeOutlets = allOutlets
          .where((outlet) => outlet.isActive)
          .toList();
      final outlets = canViewAll
          ? activeOutlets
          : await _filterAccessibleOutlets(activeOutlets);
      final selected =
          _pickOutlet(outlets, _selectedOutlet?.id) ??
          _pickOutlet(outlets, _reportOutletId) ??
          (outlets.isNotEmpty ? outlets.first : null);
      setState(() {
        _outlets = outlets;
        _selectedOutlet = selected;
        _canViewAllOutletReports = canViewAll;
        _reportOutletId = canViewAll
            ? (_reportOutletId ?? _allOutletsReportId)
            : selected?.id;
        _receiptLayout = receiptLayout;
        _isOnline = true;
      });
      await _saveOutlets();
      await _prefs?.setString(
        _receiptLayoutKey,
        jsonEncode(receiptLayout.toJson()),
      );
      if (selected != null) {
        await _prefs?.setString(_selectedOutletKey, selected.id);
        await _loadShiftAndCatalog(selected);
        await _loadSalesReport(showErrors: false);
      }
    } catch (error) {
      setState(() {
        _isOnline = _serverReachableAfter(error);
        if (showErrors) {
          _message = _readableError(error);
        }
      });
    }
  }

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

  Future<void> _loadShiftAndCatalog(Outlet outlet) async {
    setState(() => _isCatalogLoading = true);
    try {
      final results = await Future.wait([
        _api.currentShift(outlet.id),
        _api.fetchCatalog(outlet.id),
      ]);
      final shift = results[0] as Shift?;
      final catalog = results[1] as List<CatalogItem>;
      setState(() {
        _activeShift = shift;
        _catalog = catalog;
        _wasteSkuId = catalog.any((item) => item.skuId == _wasteSkuId)
            ? _wasteSkuId
            : catalog.firstOrNull?.skuId;
        _isOnline = true;
        _message = 'Data outlet diperbarui.';
      });
      await _saveCatalog();
    } catch (error) {
      setState(() {
        _isOnline = _serverReachableAfter(error);
        _message = 'Memakai katalog terakhir. ${_readableError(error)}';
      });
    } finally {
      if (mounted) {
        setState(() => _isCatalogLoading = false);
      }
    }
  }

  Future<bool> _canFetchAllOutletReport() async {
    try {
      final period = _reportRange.period();
      await _api.fetchSalesReport(null, from: period.$1, to: period.$2);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<List<Outlet>> _filterAccessibleOutlets(List<Outlet> outlets) async {
    final accessible = <Outlet>[];
    for (final outlet in outlets) {
      try {
        await _api.currentShift(outlet.id);
        accessible.add(outlet);
      } on ApiException catch (error) {
        if (error.statusCode != 403) {
          rethrow;
        }
      }
    }
    return accessible;
  }

  bool _serverReachableAfter(Object error) => error is! ApiUnavailable;

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
      setState(() {
        _salesReport = report;
        _salesDetails = details;
        _isOnline = true;
      });
    } catch (error) {
      setState(() {
        _isOnline = _serverReachableAfter(error);
        if (showErrors) {
          _message = 'Laporan belum bisa dimuat. ${_readableError(error)}';
        }
      });
    } finally {
      if (mounted) {
        setState(() => _isReportLoading = false);
      }
    }
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
    final outlet = _outlets.where((item) => item.id == id).firstOrNull;
    if (outlet == null) {
      return;
    }
    setState(() {
      _selectedOutlet = outlet;
      if (!_canViewAllOutletReports || _reportOutletId != _allOutletsReportId) {
        _reportOutletId = outlet.id;
      }
      _cartSessions = [CartSession.empty('main', 'Pelanggan 1')];
      _activeCartSessionId = 'main';
      _message = '';
    });
    await _prefs?.setString(_selectedOutletKey, outlet.id);
    await _runBusy(() => _loadShiftAndCatalog(outlet));
    await _loadSalesReport(showErrors: false);
  }

  Future<void> _openShift() async {
    final outlet = _selectedOutlet;
    if (outlet == null) {
      return;
    }
    await _runBusy(() async {
      final shift = await _api.openShift(
        outlet.id,
        _parseNumber(_openingCashController.text),
      );
      setState(() {
        _activeShift = shift;
        _actualCashController.text = _moneyPlain(shift.expectedCash);
        _message = 'Shift dibuka.';
      });
    }, failurePrefix: 'Buka shift gagal');
  }

  Future<void> _closeShift() async {
    final shift = _activeShift;
    if (shift == null) {
      return;
    }
    await _runBusy(() async {
      final closed = await _api.closeShift(
        shift.id,
        _parseNumber(_actualCashController.text),
      );
      setState(() {
        _activeShift = closed.status == 'open' ? closed : null;
        _cartSessions = [CartSession.empty('main', 'Pelanggan 1')];
        _activeCartSessionId = 'main';
        _message = 'Shift ditutup.';
      });
    }, failurePrefix: 'Tutup shift gagal');
  }

  double _saleUnitFactor(CatalogItem item) {
    return item.saleUnitToBaseFactor <= 0 ? 1 : item.saleUnitToBaseFactor;
  }

  double _availableSaleQuantity(CatalogItem item) {
    return item.availableBaseQty / _saleUnitFactor(item);
  }

  bool _isLineQuantityWithinStock(CartLine line, double quantity) {
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
    final availableSaleQty = _availableSaleQuantity(item);
    if (item.availableBaseQty <= 0 || availableSaleQty <= 0) {
      return 'Stok ${item.skuName} kosong.';
    }
    return 'Qty ${item.skuName} melebihi stok tersedia (${_qty(availableSaleQty)} ${item.saleUnitLabel}).';
  }

  String? _firstStockValidationMessage() {
    for (final line in _cart) {
      if (!_isLineQuantityWithinStock(line, line.quantity)) {
        return _stockLimitMessage(line);
      }
    }
    return null;
  }

  void _addToCart(CatalogItem item) {
    setState(() {
      final index = _cart.indexWhere((line) => line.item.skuId == item.skuId);
      final nextQuantity = index >= 0 ? _cart[index].quantity + 1 : 1.0;
      final nextLine = index >= 0
          ? _cart[index].copyWith(quantity: nextQuantity)
          : CartLine.fromCatalog(item: item, quantity: nextQuantity);
      if (!_isLineQuantityWithinStock(nextLine, nextQuantity)) {
        _message = index >= 0
            ? _stockLimitMessage(nextLine)
            : _stockLimitMessageForItem(item);
        return;
      }
      if (index >= 0) {
        _cart[index] = nextLine;
        _lastToastMessage = '';
      } else {
        _cart.add(nextLine);
      }
      _message = '${item.skuName} ditambahkan ke keranjang.';
    });
  }

  void _changeCartQuantity(CartLine line, double quantity) {
    setState(() {
      if (quantity <= 0) {
        _cart.removeWhere((item) => item.item.skuId == line.item.skuId);
        _message = '${line.item.skuName} dihapus dari keranjang.';
      } else {
        if (!_isLineQuantityWithinStock(line, quantity)) {
          _message = _stockLimitMessage(line);
          return;
        }
        final index = _cart.indexWhere(
          (item) => item.item.skuId == line.item.skuId,
        );
        if (index >= 0) {
          _cart[index] = line.copyWith(quantity: quantity);
          _message = 'Qty ${line.item.skuName} menjadi ${_qty(quantity)}.';
        }
      }
    });
  }

  void _changeCartUnit(CartLine line, UnitChoice unit) {
    setState(() {
      final updated = line.copyWith(
        unitId: unit.id,
        unitLabel: unit.label,
        unitToBaseFactor: unit.toBaseFactor,
        unitPrice: unit.price,
      );
      if (!_isLineQuantityWithinStock(updated, updated.quantity)) {
        _message = _stockLimitMessage(updated);
        return;
      }
      final index = _cart.indexWhere(
        (item) => item.item.skuId == line.item.skuId,
      );
      if (index >= 0) {
        _cart[index] = updated;
        _message = 'Satuan ${line.item.skuName} menjadi ${unit.label}.';
      }
    });
  }

  Future<void> _editQuantity(CartLine line) async {
    final controller = TextEditingController(text: _qty(line.quantity));
    final value = await showDialog<double>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(line.item.skuName),
        content: TextField(
          controller: controller,
          autofocus: true,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          inputFormatters: const [
            IndonesianNumberInputFormatter(decimal: true),
          ],
          decoration: InputDecoration(labelText: 'Qty ${line.unitLabel}'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () =>
                Navigator.pop(context, _parseNumber(controller.text)),
            child: const Text('Simpan'),
          ),
        ],
      ),
    );
    controller.dispose();
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
                child: _AppSection(
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
                          'Stok tersedia: ${_qty(selectedItem.availableBaseQty)} ${selectedItem.baseUnitCode ?? 'unit'}',
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
      await _api.createWasteAdjustment(
        outletId: outlet.id,
        skuId: item.skuId,
        quantity: quantity,
        unitId: item.baseUnitId!,
        reason: _wasteReason,
        note: _wasteNoteController.text.trim(),
      );
      _wasteQtyController.clear();
      _wasteNoteController.clear();
      await _loadShiftAndCatalog(outlet);
      setState(() {
        _isOnline = true;
        _message = 'Remahan dicatat dan stok tersedia diperbarui.';
      });
      success = true;
    }, failurePrefix: 'Input remahan gagal');
    return success;
  }

  Future<void> _checkout() async {
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

    final payload = _buildSalePayload(outlet, shift);
    final receiptData = ReceiptData.fromCart(
      receiptNumber: payload['receiptNumber']?.toString() ?? '-',
      outletName: outlet.name,
      cashierName: _currentUser?.name ?? '',
      createdAt: DateTime.now(),
      lines: List<CartLine>.from(_cart),
      subtotal: _subtotal,
      discount: _discount,
      grandTotal: _grandTotal,
      paymentMethod: _paymentMethod,
      paid: _paymentMethod == 'cash'
          ? max(_parseNumber(_paidController.text), _grandTotal)
          : _grandTotal,
    );
    await _runBusy(() async {
      try {
        await _api.createSale(payload);
        setState(() {
          _completeActiveCartSession();
          _discountController.text = '0';
          _paidController.clear();
          _isOnline = true;
          _message = 'Transaksi selesai.';
        });
        await _printReceipt(receiptData);
        await _loadShiftAndCatalog(outlet);
        await _loadSalesReport(showErrors: false);
      } on ApiException {
        rethrow;
      } catch (_) {
        _pendingSales.add(payload);
        await _savePendingSales();
        setState(() {
          _completeActiveCartSession();
          _discountController.text = '0';
          _paidController.clear();
          _isOnline = false;
          _message = 'Transaksi disimpan offline.';
        });
        await _printReceipt(receiptData);
      }
    }, failurePrefix: 'Transaksi gagal');
  }

  Map<String, dynamic> _buildSalePayload(Outlet outlet, Shift shift) {
    final now = DateTime.now();
    final idempotencyKey =
        'flutter-${now.microsecondsSinceEpoch}-${Random().nextInt(999999)}';
    final total = _grandTotal;
    final paid = _paymentMethod == 'cash'
        ? max(_parseNumber(_paidController.text), total)
        : total;
    return {
      'outletId': outlet.id,
      'shiftId': shift.id,
      'idempotencyKey': idempotencyKey,
      'receiptNumber': 'FL-${now.millisecondsSinceEpoch}',
      'items': _cart
          .map(
            (line) => {
              'skuId': line.item.skuId,
              'quantity': line.quantity,
              'unitId': line.unitId,
              'unitPrice': line.unitPrice,
              'discountTotal': 0,
            },
          )
          .toList(),
      'payments': [
        {'method': _paymentMethod, 'amount': paid},
      ],
      'discountTotal': _discount,
      'taxTotal': 0,
      'serviceChargeTotal': 0,
      'source': 'flutter_pos',
      'clientCreatedAt': now.toUtc().toIso8601String(),
    };
  }

  Future<void> _printReceipt(ReceiptData receipt) async {
    if (!_printerEnabled && !_receiptLayout.autoPrint) {
      return;
    }
    try {
      final content = buildReceiptText(_receiptLayout, receipt);
      if (_printerConnection == 'bluetooth') {
        final target = _printerBluetoothController.text.trim();
        if (target.isEmpty) {
          setState(
            () => _message =
                'Transaksi selesai, tetapi nama/MAC printer Bluetooth belum diisi.',
          );
          return;
        }
        await _printerChannel.invokeMethod('printBluetooth', {
          'target': target,
          'text': content,
        });
        setState(
          () => _message = 'Struk berhasil dikirim ke printer Bluetooth.',
        );
        return;
      }
      if (_printerConnection == 'usb') {
        setState(
          () => _message =
              'Mode USB/kabel sudah dipilih. Printing USB native membutuhkan izin USB host dan endpoint printer; gunakan IP atau Bluetooth untuk print langsung.',
        );
        return;
      }
      final host = _printerHostController.text.trim();
      final port =
          int.tryParse(
            _printerPortController.text.replaceAll('.', '').trim(),
          ) ??
          9100;
      if (host.isEmpty) {
        setState(
          () => _message =
              'Transaksi selesai, tetapi alamat printer belum diisi.',
        );
        return;
      }
      final socket = await Socket.connect(
        host,
        port,
        timeout: const Duration(seconds: 5),
      );
      socket.add([0x1B, 0x40]);
      socket.add(utf8.encode(content));
      socket.add([0x0A, 0x0A, 0x0A, 0x1D, 0x56, 0x00]);
      await socket.flush();
      await socket.close();
      setState(() => _message = 'Struk berhasil dikirim ke printer.');
    } catch (error) {
      setState(() => _message = 'Print struk gagal. ${_readableError(error)}');
    }
  }

  Future<void> _savePrinterSettings() async {
    final port =
        int.tryParse(_printerPortController.text.replaceAll('.', '').trim()) ??
        9100;
    await _prefs?.setBool(_printerEnabledKey, _printerEnabled);
    await _prefs?.setString(_printerConnectionKey, _printerConnection);
    await _prefs?.setString(
      _printerHostKey,
      _printerHostController.text.trim(),
    );
    await _prefs?.setInt(_printerPortKey, port);
    await _prefs?.setString(
      _printerBluetoothAddressKey,
      _printerBluetoothController.text.trim(),
    );
    setState(() => _message = 'Setting printer disimpan.');
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

  Future<void> _connectBluetoothPrinter(BluetoothPrinterDevice device) async {
    _printerBluetoothController.text = device.address;
    setState(() {
      _printerConnection = 'bluetooth';
      _printerEnabled = true;
      _message = 'Printer Bluetooth dipilih: ${device.displayName}.';
    });
    await _savePrinterSettings();
  }

  Future<void> _syncPending() async {
    if (_pendingSales.isEmpty) {
      setState(() => _message = 'Tidak ada antrean sync.');
      return;
    }
    await _runBusy(() async {
      final byOutlet = <String, List<Map<String, dynamic>>>{};
      for (final sale in _pendingSales) {
        final outletId = sale['outletId']?.toString();
        if (outletId == null || outletId.isEmpty) {
          continue;
        }
        byOutlet.putIfAbsent(outletId, () => []).add(sale);
      }

      final completedKeys = <String>{};
      var conflictCount = 0;
      var failedCount = 0;
      for (final entry in byOutlet.entries) {
        final results = await _api.pushSync(entry.key, entry.value);
        for (final result in results) {
          final key = result['idempotencyKey']?.toString();
          final status = result['status']?.toString();
          if (key != null && status == 'processed') {
            completedKeys.add(key);
          }
          if (status == 'conflict') conflictCount += 1;
          if (status == 'failed') failedCount += 1;
        }
      }

      _pendingSales = _pendingSales
          .where(
            (sale) =>
                !completedKeys.contains(sale['idempotencyKey']?.toString()),
          )
          .toList();
      await _savePendingSales();
      setState(() {
        _isOnline = true;
        _message = [
          if (completedKeys.isNotEmpty)
            '${completedKeys.length} transaksi tersinkron',
          if (conflictCount > 0) '$conflictCount konflik stok belum diposting',
          if (failedCount > 0) '$failedCount transaksi gagal sync',
          if (completedKeys.isEmpty && conflictCount == 0 && failedCount == 0)
            'Sync belum memproses transaksi',
        ].join('. ');
      });
      final outlet = _selectedOutlet;
      if (outlet != null) {
        await _loadShiftAndCatalog(outlet);
        await _loadSalesReport(showErrors: false);
      }
    }, failurePrefix: 'Sync gagal');
  }

  Future<void> _saveBaseUrl() async {
    final value = _baseUrlController.text.trim();
    if (value.isEmpty) {
      return;
    }
    _api = PosApi(baseUrl: value, cookie: _api.cookie, bearer: _api.bearer);
    await _prefs?.setString(_baseUrlKey, _api.baseUrl);
    if (mounted) {
      Navigator.pop(context);
      setState(() => _message = 'Base URL disimpan.');
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

  set _cart(List<CartLine> value) {
    final index = _cartSessions.indexWhere(
      (session) => session.id == _activeCartSessionId,
    );
    if (index >= 0) {
      _cartSessions[index] = _cartSessions[index].copyWith(lines: value);
    } else {
      _cartSessions = [
        CartSession.empty(
          _activeCartSessionId,
          'Pelanggan 1',
        ).copyWith(lines: value),
      ];
    }
  }

  void _newCartSession() {
    setState(() {
      final nextNumber = _cartSessions.length + 1;
      final id = 'cart-${DateTime.now().microsecondsSinceEpoch}';
      _cartSessions.add(CartSession.empty(id, 'Pelanggan $nextNumber'));
      _activeCartSessionId = id;
      _message = 'Sesi transaksi baru dibuka.';
    });
  }

  void _switchCartSession(String id) {
    setState(() {
      _activeCartSessionId = id;
      _message = 'Berpindah ke ${_activeCartSession.label}.';
    });
  }

  void _closeActiveCartSession() {
    if (_cartSessions.length <= 1) {
      setState(() {
        _cart = [];
        _message = 'Keranjang dikosongkan.';
      });
      return;
    }
    setState(() {
      _cartSessions = _cartSessions
          .where((session) => session.id != _activeCartSessionId)
          .toList();
      _activeCartSessionId = _cartSessions.first.id;
      _message = 'Sesi transaksi ditutup.';
    });
  }

  void _completeActiveCartSession() {
    if (_cartSessions.length <= 1) {
      _cart = [];
      return;
    }
    _cartSessions = _cartSessions
        .where((session) => session.id != _activeCartSessionId)
        .toList();
    _activeCartSessionId = _cartSessions.first.id;
  }

  double get _subtotal => _cart.fold(0, (sum, line) => sum + line.lineTotal);
  double get _discount =>
      min(_parseNumber(_discountController.text), _subtotal);
  double get _grandTotal => max(0, _subtotal - _discount);

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
    if (_isBooting) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (!_isSignedIn) {
      return _LoginView(
        emailController: _emailController,
        passwordController: _passwordController,
        baseUrlController: _baseUrlController,
        isBusy: _isBusy,
        message: _message,
        onSubmit: _signIn,
      );
    }

    _queueToast(_message);
    final isMobile = MediaQuery.of(context).size.width < 980;
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (_) => _resetIdleTimer(),
      onPointerMove: (_) => _resetIdleTimer(),
      onPointerSignal: (_) => _resetIdleTimer(),
      child: Scaffold(
        drawer: _buildSidebarDrawer(),
        appBar: AppBar(
          leading: Builder(
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
            expectedCash: _activeShift?.expectedCash,
          ),
          actions: [
            if (isMobile)
              _StatusIcon(online: _isOnline, pendingCount: _pendingSales.length)
            else
              _StatusPill(
                online: _isOnline,
                pendingCount: _pendingSales.length,
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
            if (_isBusy || _isReportLoading)
              const LinearProgressIndicator(minHeight: 3),
            if (_message.isNotEmpty) _MessageStrip(text: _message),
            Expanded(
              child: _selectedTab == 0 ? _buildPosBody() : _buildReportBody(),
            ),
          ],
        ),
        floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
        floatingActionButton: _selectedTab == 0 && isMobile
            ? _FloatingCartButton(
                count: _cart.length,
                total: _grandTotal,
                onPressed: _showCartSheet,
              )
            : null,
        bottomNavigationBar: NavigationBar(
          selectedIndex: _selectedTab,
          onDestinationSelected: (index) async {
            setState(() => _selectedTab = index);
            if (index == 1) {
              await _loadSalesReport(showErrors: false);
            }
          },
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
        ),
      ),
    );
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
    );
    final cart = _buildCartPane();
    final overview = _PosOverviewSection(
      outletName: _selectedOutlet?.name ?? 'Belum pilih outlet',
      shiftOpen: _activeShift != null,
      expectedCash: _activeShift?.expectedCash ?? 0,
      cartCount: _cart.length,
      cartTotal: _grandTotal,
      pendingCount: _pendingSales.length,
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth >= 980) {
          return Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  flex: 7,
                  child: Column(
                    children: [
                      overview,
                      const SizedBox(height: 12),
                      Expanded(child: products),
                    ],
                  ),
                ),
                const SizedBox(width: 16),
                SizedBox(width: 430, child: cart),
              ],
            ),
          );
        }

        return Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 108),
          child: Column(
            children: [
              _CompactPosOverview(
                shiftOpen: _activeShift != null,
                cartCount: _cart.length,
                cartTotal: _grandTotal,
                pendingCount: _pendingSales.length,
              ),
              const SizedBox(height: 8),
              Expanded(child: products),
            ],
          ),
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
      discount: _discount,
      grandTotal: _grandTotal,
      discountController: _discountController,
      paidController: _paidController,
      paymentMethod: _paymentMethod,
      pendingCount: _pendingSales.length,
      onMethodChanged: (value) {
        setState(() => _paymentMethod = value);
        afterCartChanged?.call();
      },
      onDiscountChanged: () {
        setState(() {});
        afterCartChanged?.call();
      },
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
              await _checkout();
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
      selectedRange: _reportRange,
      isLoading: _isReportLoading,
      outlets: _outlets,
      selectedOutletId: _reportOutletId ?? _selectedOutlet?.id,
      canViewAllOutlets: _canViewAllOutletReports,
      onRangeChanged: _changeReportRange,
      onOutletChanged: _changeReportOutlet,
      onRefresh: () => _loadSalesReport(),
      onReprint: (detail) => _printReceipt(
        ReceiptData.fromSalesDetail(
          detail,
          outletName: _selectedOutlet?.name ?? 'Outlet',
        ),
      ),
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
                    'POS Cemilan',
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
                  _PrinterSettingsCard(
                    enabled: _printerEnabled,
                    connection: _printerConnection,
                    hostController: _printerHostController,
                    portController: _printerPortController,
                    bluetoothController: _printerBluetoothController,
                    bluetoothDevices: _bluetoothPrinters,
                    isLoadingBluetoothDevices: _isLoadingBluetoothPrinters,
                    paperWidth: _receiptLayout.paperWidth,
                    autoPrintFromDashboard: _receiptLayout.autoPrint,
                    onEnabledChanged: (value) =>
                        setState(() => _printerEnabled = value),
                    onConnectionChanged: (value) {
                      setState(() => _printerConnection = value);
                      if (value == 'bluetooth' && _bluetoothPrinters.isEmpty) {
                        _loadBluetoothPrinters();
                      }
                    },
                    onRefreshBluetoothDevices: _loadBluetoothPrinters,
                    onConnectBluetoothDevice: _connectBluetoothPrinter,
                    onSave: _savePrinterSettings,
                    onTestPrint: () => _printReceipt(ReceiptData.sample()),
                  ),
                  const SizedBox(height: 12),
                  _SidebarGroup(
                    title: 'Tools',
                    children: [
                      _SidebarTile(
                        icon: Icons.sync,
                        title: 'Sync transaksi offline',
                        subtitle: '${_pendingSales.length} antrean',
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
                  _logout();
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
      builder: (context) => AlertDialog(
        title: const Text('Server API'),
        content: TextField(
          controller: _baseUrlController,
          decoration: const InputDecoration(
            labelText: 'Base URL',
            prefixIcon: Icon(Icons.link),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Batal'),
          ),
          TextButton.icon(
            onPressed: () async {
              final updated = await _refreshBaseUrlFromDatabase();
              if (updated && context.mounted) {
                Navigator.pop(context);
              }
            },
            icon: const Icon(Icons.cloud_sync_outlined),
            label: const Text('Ambil dari DB'),
          ),
          FilledButton.icon(
            onPressed: _saveBaseUrl,
            icon: const Icon(Icons.save_outlined),
            label: const Text('Simpan'),
          ),
        ],
      ),
    );
  }
}

class _LoginView extends StatelessWidget {
  const _LoginView({
    required this.emailController,
    required this.passwordController,
    required this.baseUrlController,
    required this.isBusy,
    required this.message,
    required this.onSubmit,
  });

  final TextEditingController emailController;
  final TextEditingController passwordController;
  final TextEditingController baseUrlController;
  final bool isBusy;
  final String message;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppPalette.ivory, AppPalette.aqua, AppPalette.blue],
          ),
        ),
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 430),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(22),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Container(
                        width: 60,
                        height: 60,
                        decoration: BoxDecoration(
                          color: AppPalette.red,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(
                          Icons.point_of_sale,
                          color: AppPalette.white,
                          size: 34,
                        ),
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        'POS Cemilan Kasir',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: AppPalette.navy,
                          fontSize: 24,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 20),
                      TextField(
                        controller: baseUrlController,
                        decoration: const InputDecoration(
                          labelText: 'Server API',
                          prefixIcon: Icon(Icons.dns_outlined),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: emailController,
                        keyboardType: TextInputType.emailAddress,
                        decoration: const InputDecoration(
                          labelText: 'Email',
                          prefixIcon: Icon(Icons.mail_outline),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: passwordController,
                        obscureText: true,
                        decoration: const InputDecoration(
                          labelText: 'Password',
                          prefixIcon: Icon(Icons.lock_outline),
                        ),
                        onSubmitted: (_) => onSubmit(),
                      ),
                      if (message.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Text(
                          message,
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.error,
                          ),
                        ),
                      ],
                      const SizedBox(height: 18),
                      FilledButton.icon(
                        onPressed: isBusy ? null : onSubmit,
                        icon: const Icon(Icons.login),
                        label: Text(isBusy ? 'Memproses' : 'Masuk'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _HeaderTitle extends StatelessWidget {
  const _HeaderTitle({
    required this.title,
    required this.outletName,
    required this.shiftOpen,
    required this.expectedCash,
  });

  final String title;
  final String outletName;
  final bool shiftOpen;
  final double? expectedCash;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18),
        ),
        const SizedBox(height: 2),
        Text(
          shiftOpen
              ? '$outletName • Shift aktif • ${_money(expectedCash ?? 0)}'
              : '$outletName • Shift belum dibuka',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            color: AppPalette.aqua,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

class _StatusIcon extends StatelessWidget {
  const _StatusIcon({required this.online, required this.pendingCount});

  final bool online;
  final int pendingCount;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: online ? 'Online' : 'Offline ($pendingCount menunggu sync)',
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4),
        child: Badge(
          isLabelVisible: !online && pendingCount > 0,
          label: Text(pendingCount.toString()),
          child: Icon(
            online ? Icons.wifi : Icons.wifi_off,
            color: online ? AppPalette.aqua : AppPalette.red,
          ),
        ),
      ),
    );
  }
}

class _ResponsivePair extends StatelessWidget {
  const _ResponsivePair({required this.first, required this.second});

  final Widget first;
  final Widget second;

  @override
  Widget build(BuildContext context) {
    const spacing = 10.0;
    const breakpoint = 560.0;
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < breakpoint) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              first,
              SizedBox(height: spacing),
              second,
            ],
          );
        }

        return Row(
          children: [
            Expanded(child: first),
            SizedBox(width: spacing),
            Expanded(child: second),
          ],
        );
      },
    );
  }
}

class _SidebarGroup extends StatelessWidget {
  const _SidebarGroup({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppPalette.white,
        border: Border.all(color: AppPalette.line),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 6),
            child: Text(
              title,
              style: const TextStyle(
                color: AppPalette.navy,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          ...children,
        ],
      ),
    );
  }
}

class _SidebarTile extends StatelessWidget {
  const _SidebarTile({
    required this.icon,
    required this.title,
    this.subtitle,
    this.selected = false,
    this.onTap,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      enabled: onTap != null,
      selected: selected,
      selectedTileColor: AppPalette.aqua.withValues(alpha: 0.32),
      leading: Icon(icon, color: selected ? AppPalette.red : AppPalette.navy),
      title: Text(
        title,
        style: TextStyle(
          fontWeight: selected ? FontWeight.w900 : FontWeight.w700,
        ),
      ),
      subtitle: subtitle == null || subtitle!.isEmpty
          ? null
          : Text(subtitle!, maxLines: 1, overflow: TextOverflow.ellipsis),
      onTap: onTap,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
    );
  }
}

class _UserSettingsCard extends StatelessWidget {
  const _UserSettingsCard({
    required this.user,
    required this.nameController,
    required this.currentPasswordController,
    required this.newPasswordController,
    required this.confirmPasswordController,
    required this.onSave,
  });

  final CurrentUser? user;
  final TextEditingController nameController;
  final TextEditingController currentPasswordController;
  final TextEditingController newPasswordController;
  final TextEditingController confirmPasswordController;
  final VoidCallback? onSave;

  @override
  Widget build(BuildContext context) {
    return _AppSection(
      title: 'Profil Kasir',
      subtitle: user == null
          ? 'Setting user kasir'
          : '${user!.email} - ${user!.role}',
      icon: Icons.person_outline,
      headerColor: AppPalette.navy,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: nameController,
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(
                labelText: 'Nama Kasir',
                prefixIcon: Icon(Icons.badge_outlined),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: currentPasswordController,
              obscureText: true,
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(
                labelText: 'Password Lama',
                prefixIcon: Icon(Icons.lock_outline),
              ),
            ),
            const SizedBox(height: 10),
            _ResponsivePair(
              first: TextField(
                controller: newPasswordController,
                obscureText: true,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(
                  labelText: 'Password Baru',
                  prefixIcon: Icon(Icons.password_outlined),
                ),
              ),
              second: TextField(
                controller: confirmPasswordController,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'Konfirmasi',
                  prefixIcon: Icon(Icons.verified_user_outlined),
                ),
              ),
            ),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: onSave,
              icon: const Icon(Icons.save_outlined),
              label: const Text('Simpan User'),
            ),
          ],
        ),
      ),
    );
  }
}

class _PrinterSettingsCard extends StatelessWidget {
  const _PrinterSettingsCard({
    required this.enabled,
    required this.connection,
    required this.hostController,
    required this.portController,
    required this.bluetoothController,
    required this.bluetoothDevices,
    required this.isLoadingBluetoothDevices,
    required this.paperWidth,
    required this.autoPrintFromDashboard,
    required this.onEnabledChanged,
    required this.onConnectionChanged,
    required this.onRefreshBluetoothDevices,
    required this.onConnectBluetoothDevice,
    required this.onSave,
    required this.onTestPrint,
  });

  final bool enabled;
  final String connection;
  final TextEditingController hostController;
  final TextEditingController portController;
  final TextEditingController bluetoothController;
  final List<BluetoothPrinterDevice> bluetoothDevices;
  final bool isLoadingBluetoothDevices;
  final String paperWidth;
  final bool autoPrintFromDashboard;
  final ValueChanged<bool> onEnabledChanged;
  final ValueChanged<String> onConnectionChanged;
  final VoidCallback onRefreshBluetoothDevices;
  final ValueChanged<BluetoothPrinterDevice> onConnectBluetoothDevice;
  final VoidCallback onSave;
  final VoidCallback onTestPrint;

  @override
  Widget build(BuildContext context) {
    return _AppSection(
      title: 'Printer Thermal',
      subtitle: 'Pilih koneksi IP, Bluetooth, atau USB/kabel',
      icon: Icons.print_outlined,
      headerColor: AppPalette.navy,
      collapsible: true,
      initiallyExpanded: false,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: enabled,
              onChanged: onEnabledChanged,
              title: const Text('Aktifkan printer kasir'),
              subtitle: Text(
                'Layout dashboard: $paperWidth mm${autoPrintFromDashboard ? ' + auto print' : ''}',
              ),
            ),
            const SizedBox(height: 10),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(
                  value: 'ip',
                  icon: Icon(Icons.wifi_tethering_outlined),
                  label: Text('IP'),
                ),
                ButtonSegment(
                  value: 'bluetooth',
                  icon: Icon(Icons.bluetooth),
                  label: Text('Bluetooth'),
                ),
                ButtonSegment(
                  value: 'usb',
                  icon: Icon(Icons.usb),
                  label: Text('USB'),
                ),
              ],
              selected: {connection},
              onSelectionChanged: (value) => onConnectionChanged(value.first),
            ),
            const SizedBox(height: 10),
            if (connection == 'ip') ...[
              TextField(
                controller: hostController,
                decoration: const InputDecoration(
                  labelText: 'IP / Host Printer',
                  prefixIcon: Icon(Icons.wifi_tethering_outlined),
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: portController,
                keyboardType: TextInputType.number,
                inputFormatters: const [
                  IndonesianNumberInputFormatter(decimal: false),
                ],
                decoration: const InputDecoration(
                  labelText: 'Port',
                  prefixIcon: Icon(Icons.settings_ethernet),
                ),
              ),
            ] else if (connection == 'bluetooth') ...[
              TextField(
                controller: bluetoothController,
                decoration: const InputDecoration(
                  labelText: 'Nama / MAC Bluetooth Printer',
                  prefixIcon: Icon(Icons.bluetooth_searching),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Pair printer thermal dari pengaturan Bluetooth Android, lalu pilih perangkat dari daftar.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: isLoadingBluetoothDevices
                    ? null
                    : onRefreshBluetoothDevices,
                icon: isLoadingBluetoothDevices
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.bluetooth_searching),
                label: Text(
                  isLoadingBluetoothDevices
                      ? 'Memuat perangkat...'
                      : 'Tampilkan Bluetooth Terhubung',
                ),
              ),
              const SizedBox(height: 10),
              if (bluetoothDevices.isEmpty)
                const ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(Icons.bluetooth_disabled_outlined),
                  title: Text('Belum ada perangkat ditampilkan'),
                  subtitle: Text(
                    'Tekan tombol di atas setelah printer sudah dipairing di pengaturan Bluetooth Android.',
                  ),
                )
              else
                ...bluetoothDevices.map(
                  (device) => Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      leading: const Icon(Icons.print_outlined),
                      title: Text(device.displayName),
                      subtitle: Text(device.address),
                      trailing: FilledButton(
                        onPressed: () => onConnectBluetoothDevice(device),
                        child: const Text('Konek'),
                      ),
                    ),
                  ),
                ),
            ] else ...[
              const ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(Icons.usb),
                title: Text('USB / kabel'),
                subtitle: Text(
                  'Gunakan kabel OTG dan printer thermal USB. Mode ini disimpan sebagai preferensi koneksi.',
                ),
              ),
            ],
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                FilledButton.icon(
                  onPressed: onSave,
                  icon: const Icon(Icons.save_outlined),
                  label: const Text('Simpan Printer'),
                ),
                OutlinedButton.icon(
                  onPressed: enabled ? onTestPrint : null,
                  icon: const Icon(Icons.receipt_long_outlined),
                  label: const Text('Test Print'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _WorkspaceBar extends StatelessWidget {
  const _WorkspaceBar({
    required this.outlets,
    required this.selectedOutlet,
    required this.activeShift,
    required this.openingCashController,
    required this.actualCashController,
    required this.onSelectOutlet,
    required this.onOpenShift,
    required this.onCloseShift,
  });

  final List<Outlet> outlets;
  final Outlet? selectedOutlet;
  final Shift? activeShift;
  final TextEditingController openingCashController;
  final TextEditingController actualCashController;
  final ValueChanged<String> onSelectOutlet;
  final VoidCallback? onOpenShift;
  final VoidCallback? onCloseShift;

  @override
  Widget build(BuildContext context) {
    final shift = activeShift;
    return _AppSection(
      title: 'Setting POS',
      subtitle: 'Outlet, shift, modal awal, dan kas aktual',
      icon: Icons.settings_outlined,
      headerColor: AppPalette.blue,
      collapsible: true,
      initiallyExpanded: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
        child: Wrap(
          spacing: 12,
          runSpacing: 10,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            SizedBox(
              width: 260,
              child: DropdownButtonFormField<String>(
                isExpanded: true,
                initialValue: selectedOutlet?.id,
                decoration: const InputDecoration(
                  labelText: 'Outlet',
                  prefixIcon: Icon(Icons.storefront_outlined),
                ),
                items: outlets
                    .map(
                      (outlet) => DropdownMenuItem(
                        value: outlet.id,
                        child: Text(
                          outlet.name,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    )
                    .toList(),
                onChanged: (value) {
                  if (value != null) {
                    onSelectOutlet(value);
                  }
                },
              ),
            ),
            if (shift == null) ...[
              SizedBox(
                width: 170,
                child: TextField(
                  controller: openingCashController,
                  keyboardType: TextInputType.number,
                  inputFormatters: const [
                    IndonesianNumberInputFormatter(decimal: false),
                  ],
                  decoration: const InputDecoration(
                    labelText: 'Modal awal',
                    prefixIcon: Icon(Icons.payments_outlined),
                  ),
                ),
              ),
              FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: AppPalette.red,
                  foregroundColor: AppPalette.white,
                ),
                onPressed: onOpenShift,
                icon: const Icon(Icons.lock_open_outlined),
                label: const Text('Buka Shift'),
              ),
            ] else ...[
              Chip(
                avatar: const Icon(Icons.badge_outlined, size: 18),
                label: Text('Shift ${shift.id.substring(0, 8)}'),
                backgroundColor: AppPalette.aqua.withValues(alpha: 0.38),
              ),
              Chip(
                avatar: const Icon(
                  Icons.account_balance_wallet_outlined,
                  size: 18,
                ),
                label: Text('Expected ${_money(shift.expectedCash)}'),
                backgroundColor: AppPalette.ivory,
              ),
              SizedBox(
                width: 170,
                child: TextField(
                  controller: actualCashController,
                  keyboardType: TextInputType.number,
                  inputFormatters: const [
                    IndonesianNumberInputFormatter(decimal: false),
                  ],
                  decoration: const InputDecoration(
                    labelText: 'Kas aktual',
                    prefixIcon: Icon(Icons.fact_check_outlined),
                  ),
                ),
              ),
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppPalette.navy,
                  side: const BorderSide(color: AppPalette.blue),
                ),
                onPressed: onCloseShift,
                icon: const Icon(Icons.lock_outline),
                label: const Text('Tutup Shift'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ProductPane extends StatelessWidget {
  const _ProductPane({
    required this.searchController,
    required this.items,
    required this.isLoading,
    required this.categories,
    required this.selectedCategory,
    required this.onCategoryChanged,
    required this.onSearchChanged,
    required this.onAdd,
  });

  final TextEditingController searchController;
  final List<CatalogItem> items;
  final bool isLoading;
  final List<String> categories;
  final String selectedCategory;
  final ValueChanged<String> onCategoryChanged;
  final VoidCallback onSearchChanged;
  final ValueChanged<CatalogItem> onAdd;

  @override
  Widget build(BuildContext context) {
    return _AppSection(
      title: 'Katalog Produk',
      subtitle: 'Pilih item untuk ditambahkan ke keranjang',
      icon: Icons.fastfood_outlined,
      headerColor: AppPalette.navy,
      fillBody: true,
      isLoading: isLoading,
      loadingText: 'Memuat katalog produk...',
      trailing: _SectionBadge(text: '${items.length} SKU'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: searchController,
                  onChanged: (_) => onSearchChanged(),
                  decoration: const InputDecoration(
                    hintText: 'Cari nama, SKU, barcode, kategori',
                    prefixIcon: Icon(Icons.search),
                  ),
                ),
                const SizedBox(height: 10),
                SizedBox(
                  height: 42,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: categories.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (context, index) {
                      final category = categories[index];
                      final selected = category == selectedCategory;
                      return ChoiceChip(
                        selected: selected,
                        label: Text(category),
                        avatar: Icon(
                          category == 'Semua'
                              ? Icons.apps_outlined
                              : Icons.local_offer_outlined,
                          size: 18,
                        ),
                        onSelected: (_) => onCategoryChanged(category),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: items.isEmpty
                ? const Center(child: Text('Belum ada produk.'))
                : Padding(
                    padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        final width = constraints.maxWidth;
                        final columns = width >= 850
                            ? 3
                            : (width >= 560 ? 2 : 1);
                        final tileHeight = columns == 1 ? 188.0 : 158.0;
                        return GridView.builder(
                          itemCount: items.length,
                          gridDelegate:
                              SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: columns,
                                mainAxisSpacing: 10,
                                crossAxisSpacing: 10,
                                mainAxisExtent: tileHeight,
                              ),
                          itemBuilder: (context, index) {
                            return _ProductTile(
                              item: items[index],
                              onAdd: () => onAdd(items[index]),
                            );
                          },
                        );
                      },
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _CompactPosOverview extends StatelessWidget {
  const _CompactPosOverview({
    required this.shiftOpen,
    required this.cartCount,
    required this.cartTotal,
    required this.pendingCount,
  });

  final bool shiftOpen;
  final int cartCount;
  final double cartTotal;
  final int pendingCount;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppPalette.white,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          border: Border.all(color: AppPalette.line),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: [
            Icon(
              shiftOpen ? Icons.lock_open_outlined : Icons.lock_outline,
              color: shiftOpen ? AppPalette.blue : AppPalette.red,
              size: 20,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                shiftOpen ? 'Shift aktif' : 'Buka shift dulu',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
            const SizedBox(width: 8),
            _MiniStat(icon: Icons.shopping_cart_outlined, text: '$cartCount'),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                _money(cartTotal),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.end,
                style: const TextStyle(
                  color: AppPalette.navy,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
            if (pendingCount > 0) ...[
              const SizedBox(width: 8),
              _MiniStat(icon: Icons.cloud_off_outlined, text: '$pendingCount'),
            ],
          ],
        ),
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
      decoration: BoxDecoration(
        color: AppPalette.aqua.withValues(alpha: 0.32),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: AppPalette.navy),
          const SizedBox(width: 4),
          Text(
            text,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: AppPalette.navy,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _PosOverviewSection extends StatelessWidget {
  const _PosOverviewSection({
    required this.outletName,
    required this.shiftOpen,
    required this.expectedCash,
    required this.cartCount,
    required this.cartTotal,
    required this.pendingCount,
  });

  final String outletName;
  final bool shiftOpen;
  final double expectedCash;
  final int cartCount;
  final double cartTotal;
  final int pendingCount;

  @override
  Widget build(BuildContext context) {
    return _AppSection(
      title: 'Ringkasan Kasir',
      subtitle: outletName,
      icon: Icons.dashboard_customize_outlined,
      headerColor: AppPalette.blue,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final columns = constraints.maxWidth >= 720 ? 4 : 2;
            return GridView.count(
              crossAxisCount: columns,
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              childAspectRatio: columns == 4 ? 2.7 : 2.0,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                _PosOverviewTile(
                  icon: shiftOpen
                      ? Icons.lock_open_outlined
                      : Icons.lock_outline,
                  label: 'Shift',
                  value: shiftOpen ? 'Aktif' : 'Belum buka',
                ),
                _PosOverviewTile(
                  icon: Icons.account_balance_wallet_outlined,
                  label: 'Kas Expected',
                  value: _money(expectedCash),
                ),
                _PosOverviewTile(
                  icon: Icons.shopping_cart_outlined,
                  label: 'Cart',
                  value: '$cartCount item',
                ),
                _PosOverviewTile(
                  icon: Icons.receipt_long_outlined,
                  label: 'Total',
                  value: _money(cartTotal),
                  accent: pendingCount > 0 ? '$pendingCount offline' : 'Ready',
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _PosOverviewTile extends StatelessWidget {
  const _PosOverviewTile({
    required this.icon,
    required this.label,
    required this.value,
    this.accent,
  });

  final IconData icon;
  final String label;
  final String value;
  final String? accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppPalette.ivory,
        border: Border.all(color: AppPalette.line),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(icon, color: AppPalette.navy),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelSmall,
                ),
                Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppPalette.navy,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                if (accent != null)
                  Text(
                    accent!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppPalette.blue,
                      fontSize: 11,
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ProductTile extends StatelessWidget {
  const _ProductTile({required this.item, required this.onAdd});

  final CatalogItem item;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final lowStock = item.availableBaseQty <= 0;
    return InkWell(
      onTap: onAdd,
      borderRadius: BorderRadius.circular(8),
      child: Ink(
        decoration: BoxDecoration(
          border: Border.all(color: AppPalette.line),
          borderRadius: BorderRadius.circular(8),
          color: AppPalette.white,
        ),
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: lowStock
                          ? AppPalette.red.withValues(alpha: 0.12)
                          : AppPalette.aqua.withValues(alpha: 0.44),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      lowStock
                          ? Icons.inventory_2_outlined
                          : Icons.fastfood_outlined,
                      color: lowStock ? AppPalette.red : AppPalette.blue,
                    ),
                  ),
                  const Spacer(),
                  SizedBox(
                    width: 38,
                    height: 38,
                    child: IconButton.filledTonal(
                      tooltip: 'Tambah',
                      onPressed: onAdd,
                      padding: EdgeInsets.zero,
                      icon: const Icon(Icons.add_shopping_cart),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                item.skuName,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
              const Spacer(),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      _money(item.price),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: Theme.of(context).colorScheme.primary,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                  const Icon(Icons.add_circle, color: AppPalette.red),
                ],
              ),
              const SizedBox(height: 5),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  _TinyChip(
                    text: item.category?.isNotEmpty == true
                        ? item.category!
                        : item.skuCode,
                  ),
                  _TinyChip(
                    text:
                        'Stok ${_qty(item.availableBaseQty)} ${item.baseUnitCode ?? ''}',
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CartPane extends StatelessWidget {
  const _CartPane({
    required this.lines,
    required this.sessions,
    required this.activeSessionId,
    required this.subtotal,
    required this.discount,
    required this.grandTotal,
    required this.discountController,
    required this.paidController,
    required this.paymentMethod,
    required this.pendingCount,
    required this.onMethodChanged,
    required this.onDiscountChanged,
    required this.onSessionChanged,
    required this.onNewSession,
    required this.onCloseSession,
    required this.onQuantityChanged,
    required this.onUnitChanged,
    required this.onEditQuantity,
    required this.onCheckout,
  });

  final List<CartLine> lines;
  final List<CartSession> sessions;
  final String activeSessionId;
  final double subtotal;
  final double discount;
  final double grandTotal;
  final TextEditingController discountController;
  final TextEditingController paidController;
  final String paymentMethod;
  final int pendingCount;
  final ValueChanged<String> onMethodChanged;
  final VoidCallback onDiscountChanged;
  final ValueChanged<String> onSessionChanged;
  final VoidCallback onNewSession;
  final VoidCallback onCloseSession;
  final void Function(CartLine line, double quantity) onQuantityChanged;
  final void Function(CartLine line, UnitChoice unit) onUnitChanged;
  final ValueChanged<CartLine> onEditQuantity;
  final VoidCallback? onCheckout;

  @override
  Widget build(BuildContext context) {
    return _AppSection(
      title: 'Keranjang',
      subtitle: 'Ringkasan pembayaran transaksi',
      icon: Icons.shopping_basket_outlined,
      headerColor: AppPalette.blue,
      fillBody: true,
      trailing: Badge.count(
        count: lines.length,
        child: const Icon(
          Icons.shopping_basket_outlined,
          color: AppPalette.white,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
            child: Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    isExpanded: true,
                    initialValue: activeSessionId,
                    decoration: const InputDecoration(
                      labelText: 'Sesi transaksi',
                      prefixIcon: Icon(Icons.groups_outlined),
                    ),
                    items: sessions
                        .map(
                          (session) => DropdownMenuItem(
                            value: session.id,
                            child: Text(
                              '${session.label} (${session.lines.length})',
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: (value) {
                      if (value != null) onSessionChanged(value);
                    },
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filledTonal(
                  tooltip: 'Sesi baru',
                  onPressed: onNewSession,
                  icon: const Icon(Icons.add),
                ),
                IconButton.outlined(
                  tooltip: 'Tutup sesi aktif',
                  onPressed: onCloseSession,
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
          ),
          Expanded(
            child: lines.isEmpty
                ? const Center(child: Text('Keranjang kosong.'))
                : ListView.separated(
                    itemCount: lines.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final line = lines[index];
                      return _CartLineTile(
                        line: line,
                        onMinus: () =>
                            onQuantityChanged(line, line.quantity - 1),
                        onPlus: () =>
                            onQuantityChanged(line, line.quantity + 1),
                        onUnitChanged: (unit) => onUnitChanged(line, unit),
                        onEdit: () => onEditQuantity(line),
                        onRemove: () => onQuantityChanged(line, 0),
                      );
                    },
                  ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
            child: Column(
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: const [
                    _PaymentChip(
                      value: 'cash',
                      label: 'Tunai',
                      icon: Icons.payments_outlined,
                    ),
                    _PaymentChip(
                      value: 'qris',
                      label: 'QRIS',
                      icon: Icons.qr_code_2,
                    ),
                    _PaymentChip(
                      value: 'transfer',
                      label: 'Transfer',
                      icon: Icons.account_balance_outlined,
                    ),
                    _PaymentChip(
                      value: 'card',
                      label: 'Kartu',
                      icon: Icons.credit_card,
                    ),
                    _PaymentChip(
                      value: 'ewallet',
                      label: 'E-Wallet',
                      icon: Icons.account_balance_wallet_outlined,
                    ),
                  ],
                ).wrapWithChoiceGroup(paymentMethod, onMethodChanged),
                const SizedBox(height: 12),
                _ResponsivePair(
                  first: TextField(
                    controller: discountController,
                    keyboardType: TextInputType.number,
                    inputFormatters: const [
                      IndonesianNumberInputFormatter(decimal: false),
                    ],
                    onChanged: (_) => onDiscountChanged(),
                    decoration: const InputDecoration(
                      labelText: 'Diskon',
                      prefixIcon: Icon(Icons.percent),
                    ),
                  ),
                  second: TextField(
                    controller: paidController,
                    keyboardType: TextInputType.number,
                    inputFormatters: const [
                      IndonesianNumberInputFormatter(decimal: false),
                    ],
                    decoration: const InputDecoration(
                      labelText: 'Dibayar',
                      prefixIcon: Icon(Icons.attach_money),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                _TotalRow(label: 'Subtotal', value: _money(subtotal)),
                _TotalRow(label: 'Diskon', value: _money(discount)),
                const Divider(),
                _TotalRow(
                  label: 'Total',
                  value: _money(grandTotal),
                  isLarge: true,
                ),
                if (pendingCount > 0) ...[
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Icon(Icons.cloud_upload_outlined, size: 18),
                      const SizedBox(width: 6),
                      Text('$pendingCount transaksi menunggu sync'),
                    ],
                  ),
                ],
                const SizedBox(height: 12),
                FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: AppPalette.red,
                    foregroundColor: AppPalette.white,
                  ),
                  onPressed: lines.isEmpty ? null : onCheckout,
                  icon: const Icon(Icons.receipt_long_outlined),
                  label: const Text('Bayar'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PaymentChip extends StatelessWidget {
  const _PaymentChip({
    required this.value,
    required this.label,
    required this.icon,
  });

  final String value;
  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final group = _PaymentGroup.of(context);
    final selected = group.value == value;
    return ChoiceChip(
      selected: selected,
      avatar: Icon(icon, size: 18),
      label: Text(label),
      onSelected: (_) => group.onChanged(value),
    );
  }
}

class _PaymentGroup extends InheritedWidget {
  const _PaymentGroup({
    required this.value,
    required this.onChanged,
    required super.child,
  });

  final String value;
  final ValueChanged<String> onChanged;

  static _PaymentGroup of(BuildContext context) {
    return context.dependOnInheritedWidgetOfExactType<_PaymentGroup>()!;
  }

  @override
  bool updateShouldNotify(_PaymentGroup oldWidget) {
    return value != oldWidget.value;
  }
}

extension _ChoiceWrapExtension on Wrap {
  Widget wrapWithChoiceGroup(String value, ValueChanged<String> onChanged) {
    return _PaymentGroup(value: value, onChanged: onChanged, child: this);
  }
}

class _CartLineTile extends StatelessWidget {
  const _CartLineTile({
    required this.line,
    required this.onMinus,
    required this.onPlus,
    required this.onUnitChanged,
    required this.onEdit,
    required this.onRemove,
  });

  final CartLine line;
  final VoidCallback onMinus;
  final VoidCallback onPlus;
  final ValueChanged<UnitChoice> onUnitChanged;
  final VoidCallback onEdit;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  line.item.skuName,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 4),
                Text('${_money(line.unitPrice)} / ${line.unitLabel}'),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  isExpanded: true,
                  initialValue: line.unitId,
                  decoration: const InputDecoration(
                    labelText: 'Satuan',
                    isDense: true,
                  ),
                  items: line.item.unitChoices
                      .map(
                        (unit) => DropdownMenuItem(
                          value: unit.id,
                          child: Text(unit.label),
                        ),
                      )
                      .toList(),
                  onChanged: (value) {
                    final unit = line.item.unitChoices
                        .where((item) => item.id == value)
                        .firstOrNull;
                    if (unit != null) onUnitChanged(unit);
                  },
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton.outlined(
                      tooltip: 'Kurangi',
                      onPressed: onMinus,
                      icon: const Icon(Icons.remove),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                      child: OutlinedButton(
                        onPressed: onEdit,
                        child: Text(_qty(line.quantity)),
                      ),
                    ),
                    IconButton.outlined(
                      tooltip: 'Tambah',
                      onPressed: onPlus,
                      icon: const Icon(Icons.add),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 132),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  _money(line.lineTotal),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.end,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
                IconButton(
                  tooltip: 'Hapus',
                  onPressed: onRemove,
                  icon: const Icon(Icons.delete_outline),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.online, required this.pendingCount});

  final bool online;
  final int pendingCount;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 6),
      child: Chip(
        avatar: Icon(
          online ? Icons.wifi : Icons.wifi_off,
          size: 18,
          color: online ? AppPalette.blue : AppPalette.red,
        ),
        label: Text(online ? 'Online' : 'Offline ($pendingCount)'),
        backgroundColor: online
            ? AppPalette.aqua.withValues(alpha: 0.42)
            : AppPalette.red.withValues(alpha: 0.12),
      ),
    );
  }
}

class _MessageStrip extends StatelessWidget {
  const _MessageStrip({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: AppPalette.aqua.withValues(alpha: 0.45),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
      child: Text(text),
    );
  }
}

class _FloatingCartButton extends StatelessWidget {
  const _FloatingCartButton({
    required this.count,
    required this.total,
    required this.onPressed,
  });

  final int count;
  final double total;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final compact = constraints.maxWidth < 360;
          return Material(
            color: Theme.of(context).colorScheme.primary,
            borderRadius: BorderRadius.circular(8),
            elevation: 10,
            child: InkWell(
              onTap: onPressed,
              borderRadius: BorderRadius.circular(8),
              child: Container(
                width: double.infinity,
                height: 64,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                child: Row(
                  children: [
                    Badge.count(
                      count: count,
                      child: const Icon(
                        Icons.shopping_cart_outlined,
                        color: AppPalette.white,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Keranjang',
                            style: TextStyle(
                              color: AppPalette.ivory,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          Text(
                            _money(total),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: AppPalette.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    if (compact)
                      IconButton.filledTonal(
                        tooltip: 'Bayar',
                        onPressed: onPressed,
                        icon: const Icon(Icons.arrow_forward),
                      )
                    else
                      FilledButton.tonalIcon(
                        onPressed: onPressed,
                        icon: const Icon(Icons.arrow_forward),
                        label: const Text('Bayar'),
                      ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _AppSection extends StatefulWidget {
  const _AppSection({
    required this.title,
    required this.child,
    this.subtitle,
    this.icon,
    this.trailing,
    this.headerColor = AppPalette.navy,
    this.fillBody = false,
    this.isLoading = false,
    this.loadingText = 'Memuat data section...',
    this.collapsible = false,
    this.initiallyExpanded = true,
  });

  final String title;
  final String? subtitle;
  final IconData? icon;
  final Widget? trailing;
  final Color headerColor;
  final Widget child;
  final bool fillBody;
  final bool isLoading;
  final String loadingText;
  final bool collapsible;
  final bool initiallyExpanded;

  @override
  State<_AppSection> createState() => _AppSectionState();
}

class _AppSectionState extends State<_AppSection> {
  late var _isExpanded = widget.initiallyExpanded;

  @override
  Widget build(BuildContext context) {
    final content = widget.isLoading
        ? _SectionLoading(text: widget.loadingText)
        : widget.child;
    final body = widget.fillBody ? Expanded(child: content) : content;
    final showBody = !widget.collapsible || _isExpanded;
    final header = Container(
      color: widget.headerColor,
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          if (widget.icon != null) ...[
            Icon(widget.icon, color: AppPalette.white),
            const SizedBox(width: 10),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppPalette.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                if (widget.subtitle != null)
                  Text(
                    widget.subtitle!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppPalette.aqua,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
              ],
            ),
          ),
          if (widget.trailing != null) widget.trailing!,
          if (widget.collapsible) ...[
            if (widget.trailing != null) const SizedBox(width: 8),
            IconButton(
              tooltip: _isExpanded ? 'Tutup' : 'Buka',
              onPressed: () => setState(() => _isExpanded = !_isExpanded),
              icon: Icon(
                _isExpanded
                    ? Icons.keyboard_arrow_up
                    : Icons.keyboard_arrow_down,
                color: AppPalette.white,
              ),
            ),
          ],
        ],
      ),
    );

    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: widget.fillBody ? MainAxisSize.max : MainAxisSize.min,
        children: [
          widget.collapsible
              ? InkWell(
                  onTap: () => setState(() => _isExpanded = !_isExpanded),
                  child: header,
                )
              : header,
          if (showBody) body,
        ],
      ),
    );
  }
}

class _SectionLoading extends StatelessWidget {
  const _SectionLoading({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(14),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const SizedBox(height: 8),
          const CircularProgressIndicator(),
          const SizedBox(height: 14),
          Text(
            text,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: AppPalette.blue,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 14),
          const _LoadingBar(widthFactor: 0.9),
          const SizedBox(height: 8),
          const _LoadingBar(widthFactor: 0.7),
          const SizedBox(height: 8),
          const _LoadingBar(widthFactor: 0.82),
        ],
      ),
    );
  }
}

class _LoadingBar extends StatelessWidget {
  const _LoadingBar({required this.widthFactor});

  final double widthFactor;

  @override
  Widget build(BuildContext context) {
    return FractionallySizedBox(
      widthFactor: widthFactor,
      child: Container(
        height: 12,
        decoration: BoxDecoration(
          color: AppPalette.line,
          borderRadius: BorderRadius.circular(8),
        ),
      ),
    );
  }
}

class _SectionBadge extends StatelessWidget {
  const _SectionBadge({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppPalette.aqua,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        text,
        style: const TextStyle(
          color: AppPalette.navy,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _SalesReportPane extends StatefulWidget {
  const _SalesReportPane({
    required this.report,
    required this.details,
    required this.selectedRange,
    required this.isLoading,
    required this.outlets,
    required this.selectedOutletId,
    required this.canViewAllOutlets,
    required this.onRangeChanged,
    required this.onOutletChanged,
    required this.onRefresh,
    required this.onReprint,
  });

  final SalesReport? report;
  final List<SalesDetail> details;
  final ReportRange selectedRange;
  final bool isLoading;
  final List<Outlet> outlets;
  final String? selectedOutletId;
  final bool canViewAllOutlets;
  final ValueChanged<ReportRange> onRangeChanged;
  final ValueChanged<String> onOutletChanged;
  final VoidCallback onRefresh;
  final ValueChanged<SalesDetail> onReprint;

  @override
  State<_SalesReportPane> createState() => _SalesReportPaneState();
}

class _SalesReportPaneState extends State<_SalesReportPane> {
  var _search = '';
  var _paymentFilter = 'all';
  var _statusFilter = 'all';
  var _sort = 'date-desc';
  var _page = 1;
  var _pageSize = 20;

  @override
  Widget build(BuildContext context) {
    final current = widget.report ?? SalesReport.empty();
    final paymentOptions =
        widget.details
            .expand((item) => item.paymentMethods.split(','))
            .map((item) => item.trim())
            .where((item) => item.isNotEmpty)
            .toSet()
            .toList()
          ..sort();
    final statusOptions =
        widget.details.map((item) => item.status).toSet().toList()..sort();
    final visibleDetails =
        widget.details.where((item) {
          final keyword = _search.trim().toLowerCase();
          final matchesSearch =
              keyword.isEmpty ||
              [
                item.receiptNumber,
                item.cashierName,
                item.status,
                item.paymentMethods,
                _money(item.grandTotal),
              ].join(' ').toLowerCase().contains(keyword);
          final payments = item.paymentMethods
              .split(',')
              .map((method) => method.trim())
              .where((method) => method.isNotEmpty)
              .toList();
          final matchesPayment =
              _paymentFilter == 'all' || payments.contains(_paymentFilter);
          final matchesStatus =
              _statusFilter == 'all' || item.status == _statusFilter;
          return matchesSearch && matchesPayment && matchesStatus;
        }).toList()..sort((a, b) {
          switch (_sort) {
            case 'date-asc':
              return a.createdAt.compareTo(b.createdAt);
            case 'total-desc':
              return b.grandTotal.compareTo(a.grandTotal);
            case 'total-asc':
              return a.grandTotal.compareTo(b.grandTotal);
            case 'profit-desc':
              return b.grossProfit.compareTo(a.grossProfit);
            default:
              return b.createdAt.compareTo(a.createdAt);
          }
        });
    final pageCount = max(1, (visibleDetails.length / _pageSize).ceil());
    final safePage = min(_page, pageCount);
    final pagedDetails = visibleDetails
        .skip((safePage - 1) * _pageSize)
        .take(_pageSize)
        .toList();
    final reportOutletIds = {
      if (widget.canViewAllOutlets) _PosShellState._allOutletsReportId,
      ...widget.outlets.map((item) => item.id),
    };
    final effectiveOutletId = reportOutletIds.contains(widget.selectedOutletId)
        ? widget.selectedOutletId
        : (widget.canViewAllOutlets
              ? _PosShellState._allOutletsReportId
              : (widget.outlets.isNotEmpty ? widget.outlets.first.id : null));
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Laporan Penjualan',
                    style: TextStyle(
                      color: AppPalette.navy,
                      fontWeight: FontWeight.w900,
                      fontSize: 22,
                    ),
                  ),
                  Text(
                    effectiveOutletId == _PosShellState._allOutletsReportId
                        ? 'Semua Outlet'
                        : widget.outlets
                                  .where((item) => item.id == effectiveOutletId)
                                  .firstOrNull
                                  ?.name ??
                              'Outlet',
                    style: Theme.of(
                      context,
                    ).textTheme.bodyMedium?.copyWith(color: AppPalette.blue),
                  ),
                  Text(
                    widget.selectedRange.label,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
            ),
            IconButton.filledTonal(
              tooltip: 'Refresh',
              onPressed: widget.isLoading ? null : widget.onRefresh,
              icon: const Icon(Icons.refresh),
            ),
          ],
        ),
        const SizedBox(height: 16),
        _AppSection(
          title: 'Filter Laporan',
          subtitle: 'Pilih outlet dan periode penjualan',
          icon: Icons.tune,
          headerColor: AppPalette.blue,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                DropdownButtonFormField<String>(
                  isExpanded: true,
                  initialValue: effectiveOutletId,
                  decoration: const InputDecoration(
                    labelText: 'Outlet Laporan',
                    prefixIcon: Icon(Icons.storefront_outlined),
                  ),
                  items: [
                    if (widget.canViewAllOutlets)
                      const DropdownMenuItem(
                        value: _PosShellState._allOutletsReportId,
                        child: Text('Semua Outlet'),
                      ),
                    ...widget.outlets.map(
                      (outlet) => DropdownMenuItem(
                        value: outlet.id,
                        child: Text(
                          outlet.name,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ),
                  ],
                  onChanged: widget.isLoading
                      ? null
                      : (value) {
                          if (value != null) {
                            widget.onOutletChanged(value);
                          }
                        },
                ),
                const SizedBox(height: 12),
                SegmentedButton<ReportRange>(
                  segments: ReportRange.values
                      .map(
                        (range) => ButtonSegment(
                          value: range,
                          label: Text(range.shortLabel),
                          icon: Icon(range.icon),
                        ),
                      )
                      .toList(),
                  selected: {widget.selectedRange},
                  onSelectionChanged: widget.isLoading
                      ? null
                      : (value) => widget.onRangeChanged(value.first),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        _ReportHeroCard(report: current),
        const SizedBox(height: 12),
        LayoutBuilder(
          builder: (context, constraints) {
            final columns = constraints.maxWidth >= 720
                ? 4
                : (constraints.maxWidth >= 520 ? 2 : 1);
            return GridView.count(
              crossAxisCount: columns,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: columns == 1 ? 3.2 : 1.45,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                _ReportMetricCard(
                  title: 'Transaksi',
                  value: current.transactionCount.toString(),
                  icon: Icons.receipt_long_outlined,
                ),
                _ReportMetricCard(
                  title: 'Gross Sales',
                  value: _money(current.grossSales),
                  icon: Icons.trending_up,
                ),
                _ReportMetricCard(
                  title: 'HPP',
                  value: _money(current.cogs),
                  icon: Icons.inventory_2_outlined,
                ),
                _ReportMetricCard(
                  title: 'Laba Kotor',
                  value: _money(current.grossProfit),
                  icon: Icons.savings_outlined,
                ),
              ],
            );
          },
        ),
        const SizedBox(height: 12),
        _ReportSummaryTotal(report: current, isLoading: widget.isLoading),
        const SizedBox(height: 18),
        _AppSection(
          title: 'List Transaksi',
          subtitle: 'Filter, urutkan, dan cek detail struk',
          icon: Icons.receipt_long_outlined,
          headerColor: AppPalette.navy,
          isLoading: widget.isLoading,
          loadingText: 'Memuat list transaksi...',
          trailing: _SectionBadge(
            text: '${visibleDetails.length}/${widget.details.length} struk',
          ),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  decoration: const InputDecoration(
                    labelText: 'Cari transaksi',
                    prefixIcon: Icon(Icons.search),
                  ),
                  onChanged: (value) => setState(() {
                    _search = value;
                    _page = 1;
                  }),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        isExpanded: true,
                        initialValue: _statusFilter,
                        decoration: const InputDecoration(labelText: 'Status'),
                        items: [
                          const DropdownMenuItem(
                            value: 'all',
                            child: Text('Semua'),
                          ),
                          ...statusOptions.map(
                            (value) => DropdownMenuItem(
                              value: value,
                              child: Text(value),
                            ),
                          ),
                        ],
                        onChanged: (value) {
                          if (value != null) {
                            setState(() {
                              _statusFilter = value;
                              _page = 1;
                            });
                          }
                        },
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        isExpanded: true,
                        initialValue: _paymentFilter,
                        decoration: const InputDecoration(
                          labelText: 'Pembayaran',
                        ),
                        items: [
                          const DropdownMenuItem(
                            value: 'all',
                            child: Text('Semua'),
                          ),
                          ...paymentOptions.map(
                            (value) => DropdownMenuItem(
                              value: value,
                              child: Text(value),
                            ),
                          ),
                        ],
                        onChanged: (value) {
                          if (value != null) {
                            setState(() {
                              _paymentFilter = value;
                              _page = 1;
                            });
                          }
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  isExpanded: true,
                  initialValue: _sort,
                  decoration: const InputDecoration(
                    labelText: 'Urutkan',
                    prefixIcon: Icon(Icons.sort),
                  ),
                  items: const [
                    DropdownMenuItem(
                      value: 'date-desc',
                      child: Text('Terbaru'),
                    ),
                    DropdownMenuItem(value: 'date-asc', child: Text('Terlama')),
                    DropdownMenuItem(
                      value: 'total-desc',
                      child: Text('Total terbesar'),
                    ),
                    DropdownMenuItem(
                      value: 'total-asc',
                      child: Text('Total terkecil'),
                    ),
                    DropdownMenuItem(
                      value: 'profit-desc',
                      child: Text('Laba terbesar'),
                    ),
                  ],
                  onChanged: (value) {
                    if (value != null) {
                      setState(() {
                        _sort = value;
                        _page = 1;
                      });
                    }
                  },
                ),
                const SizedBox(height: 12),
                _MobilePagination(
                  page: safePage,
                  pageSize: _pageSize,
                  total: visibleDetails.length,
                  onPageChanged: (value) => setState(() => _page = value),
                  onPageSizeChanged: (value) => setState(() {
                    _pageSize = value;
                    _page = 1;
                  }),
                ),
                const SizedBox(height: 12),
                if (visibleDetails.isEmpty)
                  const Card(
                    child: Padding(
                      padding: EdgeInsets.all(16),
                      child: Text('Belum ada transaksi pada periode ini.'),
                    ),
                  )
                else
                  ...pagedDetails.map(
                    (item) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: _SalesDetailCard(
                        item: item,
                        onReprint: () => widget.onReprint(item),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _SalesDetailCard extends StatelessWidget {
  const _SalesDetailCard({required this.item, required this.onReprint});

  final SalesDetail item;
  final VoidCallback onReprint;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: AppPalette.aqua.withValues(alpha: 0.35),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(
                    Icons.receipt_long_outlined,
                    color: AppPalette.navy,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.receiptNumber,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontWeight: FontWeight.w900,
                          color: AppPalette.navy,
                        ),
                      ),
                      Text(
                        _dateTimeLabel(item.createdAt),
                        style: Theme.of(
                          context,
                        ).textTheme.bodySmall?.copyWith(color: AppPalette.blue),
                      ),
                    ],
                  ),
                ),
                Flexible(
                  child: Text(
                    _money(item.grandTotal),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.end,
                    style: const TextStyle(
                      color: AppPalette.red,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _TinyChip(
                  text: item.cashierName.isEmpty ? 'Kasir' : item.cashierName,
                ),
                _TinyChip(
                  text: item.paymentMethods.isEmpty ? '-' : item.paymentMethods,
                ),
                _TinyChip(text: '${item.itemCount} item'),
                _TinyChip(text: item.status),
              ],
            ),
            const SizedBox(height: 10),
            _TotalRow(label: 'Subtotal', value: _money(item.subtotal)),
            _TotalRow(label: 'Diskon', value: _money(item.discountTotal)),
            _TotalRow(label: 'Laba Kotor', value: _money(item.grossProfit)),
            if (item.items.isNotEmpty) ...[
              const SizedBox(height: 10),
              const Divider(height: 1),
              const SizedBox(height: 8),
              ...item.items.map(
                (line) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          '${line.name} - ${_qty(line.quantityInput)} ${line.unitCode}',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        _money(line.lineTotal),
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ],
                  ),
                ),
              ),
            ],
            const SizedBox(height: 10),
            Align(
              alignment: Alignment.centerRight,
              child: OutlinedButton.icon(
                onPressed: onReprint,
                icon: const Icon(Icons.print_outlined),
                label: const Text('Cetak Ulang Struk'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MobilePagination extends StatelessWidget {
  const _MobilePagination({
    required this.page,
    required this.pageSize,
    required this.total,
    required this.onPageChanged,
    required this.onPageSizeChanged,
  });

  final int page;
  final int pageSize;
  final int total;
  final ValueChanged<int> onPageChanged;
  final ValueChanged<int> onPageSizeChanged;

  @override
  Widget build(BuildContext context) {
    final pageCount = max(1, (total / pageSize).ceil());
    final start = total == 0 ? 0 : ((page - 1) * pageSize) + 1;
    final end = min(total, page * pageSize);
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppPalette.ivory,
        border: Border.all(color: AppPalette.line),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Wrap(
        spacing: 10,
        runSpacing: 10,
        crossAxisAlignment: WrapCrossAlignment.center,
        alignment: WrapAlignment.spaceBetween,
        children: [
          Text(
            '$start-$end dari $total data',
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          DropdownButton<int>(
            value: pageSize,
            items: const [10, 20, 50, 100]
                .map(
                  (value) => DropdownMenuItem(
                    value: value,
                    child: Text('$value / halaman'),
                  ),
                )
                .toList(),
            onChanged: (value) {
              if (value != null) onPageSizeChanged(value);
            },
          ),
          IconButton.outlined(
            tooltip: 'Sebelumnya',
            onPressed: page <= 1 ? null : () => onPageChanged(page - 1),
            icon: const Icon(Icons.chevron_left),
          ),
          Text('$page / $pageCount'),
          IconButton.outlined(
            tooltip: 'Berikutnya',
            onPressed: page >= pageCount ? null : () => onPageChanged(page + 1),
            icon: const Icon(Icons.chevron_right),
          ),
        ],
      ),
    );
  }
}

class _ReportSummaryTotal extends StatelessWidget {
  const _ReportSummaryTotal({required this.report, required this.isLoading});

  final SalesReport report;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    final average = report.transactionCount == 0
        ? 0
        : report.netSales / report.transactionCount;
    final margin = report.netSales == 0
        ? 0
        : (report.grossProfit / report.netSales) * 100;
    return _AppSection(
      title: 'Kesimpulan Data',
      subtitle: 'Total laporan dari periode aktif',
      icon: Icons.summarize_outlined,
      headerColor: AppPalette.blue,
      isLoading: isLoading,
      loadingText: 'Menghitung kesimpulan laporan...',
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _TotalRow(
              label: 'Total Transaksi',
              value: report.transactionCount.toString(),
            ),
            _TotalRow(label: 'Total Gross', value: _money(report.grossSales)),
            _TotalRow(label: 'Total Net', value: _money(report.netSales)),
            _TotalRow(label: 'Total HPP', value: _money(report.cogs)),
            _TotalRow(label: 'Total Laba', value: _money(report.grossProfit)),
            _TotalRow(label: 'Rata-rata / Struk', value: _money(average)),
            _TotalRow(
              label: 'Margin Laba Kotor',
              value: '${_qty(margin)}%',
              isLarge: true,
            ),
          ],
        ),
      ),
    );
  }
}

class _ReportHeroCard extends StatelessWidget {
  const _ReportHeroCard({required this.report});

  final SalesReport report;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primary,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Net Sales',
            style: TextStyle(
              color: AppPalette.ivory,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              _money(report.netSales),
              style: const TextStyle(
                color: AppPalette.white,
                fontSize: 30,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              const Icon(
                Icons.point_of_sale,
                color: AppPalette.ivory,
                size: 18,
              ),
              const SizedBox(width: 6),
              Text(
                '${report.transactionCount} transaksi selesai',
                style: const TextStyle(color: AppPalette.ivory),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ReportMetricCard extends StatelessWidget {
  const _ReportMetricCard({
    required this.title,
    required this.value,
    required this.icon,
  });

  final String title;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: Theme.of(context).colorScheme.primary),
            const Spacer(),
            Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelMedium,
            ),
            const SizedBox(height: 4),
            Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
            ),
          ],
        ),
      ),
    );
  }
}

class _TinyChip extends StatelessWidget {
  const _TinyChip({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppPalette.aqua.withValues(alpha: 0.3),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        text,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: Theme.of(context).textTheme.labelSmall,
      ),
    );
  }
}

class _TotalRow extends StatelessWidget {
  const _TotalRow({
    required this.label,
    required this.value,
    this.isLarge = false,
  });

  final String label;
  final String value;
  final bool isLarge;

  @override
  Widget build(BuildContext context) {
    final style = isLarge
        ? Theme.of(
            context,
          ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)
        : Theme.of(context).textTheme.bodyMedium;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(child: Text(label, style: style)),
          const SizedBox(width: 12),
          Flexible(
            child: Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.end,
              style: style,
            ),
          ),
        ],
      ),
    );
  }
}

class PosApi {
  PosApi({required String baseUrl, this.cookie = '', this.bearer = ''})
    : baseUrl = _normalizeBaseUrl(baseUrl);

  final String baseUrl;
  String cookie;
  String bearer;

  static String _normalizeBaseUrl(String value) {
    final trimmed = value.trim();
    if (trimmed.endsWith('/')) {
      return trimmed.substring(0, trimmed.length - 1);
    }
    return trimmed;
  }

  Future<void> signIn(String email, String password) async {
    final response = await _send(
      'POST',
      '/api/auth/sign-in/email',
      body: {'email': email, 'password': password},
      auth: false,
    );
    _captureAuth(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw _apiException(response);
    }
    final body = _tryDecode(response.body);
    bearer = _findToken(body) ?? bearer;
  }

  Future<String?> fetchPublicApiUrl() async {
    final response = await _send('GET', '/api/public-url', auth: false);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw _apiException(response);
    }

    final decoded = _tryDecode(response.body);
    if (decoded is Map && decoded['data'] is Map) {
      final data = Map<String, dynamic>.from(decoded['data'] as Map);
      final publicApiUrl = data['publicApiUrl']?.toString().trim();
      if (publicApiUrl != null && publicApiUrl.isNotEmpty) {
        return _normalizeBaseUrl(publicApiUrl);
      }
    }
    return null;
  }

  Future<List<Outlet>> listOutlets() async {
    final data = await _request('GET', '/api/outlets');
    return (data as List)
        .map((item) => Outlet.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  Future<CurrentUser> fetchProfile() async {
    final data = await _request('GET', '/api/profile');
    return CurrentUser.fromJson(Map<String, dynamic>.from(data));
  }

  Future<CurrentUser> updateProfile(String name) async {
    final data = await _request('PATCH', '/api/profile', body: {'name': name});
    return CurrentUser.fromJson(Map<String, dynamic>.from(data));
  }

  Future<ReceiptLayout> fetchReceiptLayout() async {
    final data = await _request('GET', '/api/settings');
    if (data is Map && data['receiptLayout'] is Map) {
      return ReceiptLayout.fromJson(
        Map<String, dynamic>.from(data['receiptLayout'] as Map),
      );
    }
    return ReceiptLayout.defaultLayout();
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final data = await _request(
      'POST',
      '/api/auth/change-password',
      body: {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
        'revokeOtherSessions': false,
      },
    );
    if (data is Map && data['token'] is String) {
      bearer = data['token'].toString();
    }
  }

  Future<List<CatalogItem>> fetchCatalog(String outletId) async {
    final data = await _request('GET', '/api/catalog?outletId=$outletId');
    final rows = (data['items'] as List?) ?? [];
    return rows
        .map((item) => CatalogItem.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  Future<SalesReport> fetchSalesReport(
    String? outletId, {
    required DateTime from,
    required DateTime to,
  }) async {
    final query = Uri(
      queryParameters: {
        if (outletId != null) 'outletId': outletId,
        'from': from.toUtc().toIso8601String(),
        'to': to.toUtc().toIso8601String(),
      },
    ).query;
    final data = await _request('GET', '/api/reports/sales-summary?$query');
    return SalesReport.fromJson(Map<String, dynamic>.from(data));
  }

  Future<List<SalesDetail>> fetchSalesDetails(
    String? outletId, {
    required DateTime from,
    required DateTime to,
  }) async {
    final query = Uri(
      queryParameters: {
        if (outletId != null) 'outletId': outletId,
        'from': from.toUtc().toIso8601String(),
        'to': to.toUtc().toIso8601String(),
      },
    ).query;
    final data = await _request('GET', '/api/reports/sales-detail?$query');
    return (data as List)
        .map((item) => SalesDetail.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  Future<Shift?> currentShift(String outletId) async {
    final data = await _request(
      'GET',
      '/api/shifts/current?outletId=$outletId',
    );
    if (data == null) {
      return null;
    }
    return Shift.fromJson(Map<String, dynamic>.from(data));
  }

  Future<Shift> openShift(String outletId, double openingCash) async {
    final data = await _request(
      'POST',
      '/api/shifts/open',
      body: {'outletId': outletId, 'openingCash': openingCash},
    );
    return Shift.fromJson(Map<String, dynamic>.from(data));
  }

  Future<Shift> closeShift(String shiftId, double actualCash) async {
    final data = await _request(
      'POST',
      '/api/shifts/close',
      body: {'shiftId': shiftId, 'actualCash': actualCash},
    );
    return Shift.fromJson(Map<String, dynamic>.from(data));
  }

  Future<void> createSale(Map<String, dynamic> payload) async {
    await _request('POST', '/api/sales', body: payload);
  }

  Future<void> createWasteAdjustment({
    required String outletId,
    required String skuId,
    required double quantity,
    required String unitId,
    required String reason,
    String? note,
  }) async {
    await _request(
      'POST',
      '/api/waste-adjustments',
      body: {
        'outletId': outletId,
        'skuId': skuId,
        'quantity': quantity,
        'unitId': unitId,
        'reason': reason,
        if (note != null && note.isNotEmpty) 'note': note,
      },
    );
  }

  Future<List<Map<String, dynamic>>> pushSync(
    String outletId,
    List<Map<String, dynamic>> transactions,
  ) async {
    final data = await _request(
      'POST',
      '/api/sync/push',
      body: {'outletId': outletId, 'transactions': transactions},
    );
    final rows = (data['results'] as List?) ?? [];
    return rows
        .cast<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  Future<dynamic> _request(String method, String path, {Object? body}) async {
    final response = await _send(method, path, body: body);
    _captureAuth(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw _apiException(response);
    }
    final decoded = _tryDecode(response.body);
    if (decoded is Map && decoded.containsKey('data')) {
      return decoded['data'];
    }
    return decoded;
  }

  Future<http.Response> _send(
    String method,
    String path, {
    Object? body,
    bool auth = true,
  }) async {
    final uri = Uri.parse('$baseUrl$path');
    final headers = <String, String>{
      'Accept': 'application/json',
      if (body != null) 'Content-Type': 'application/json',
      if (auth && cookie.isNotEmpty) 'Cookie': cookie,
      if (auth && bearer.isNotEmpty) 'Authorization': 'Bearer $bearer',
    };
    final encodedBody = body == null ? null : jsonEncode(body);

    try {
      return switch (method) {
        'GET' =>
          await http
              .get(uri, headers: headers)
              .timeout(const Duration(seconds: 8)),
        'POST' =>
          await http
              .post(uri, headers: headers, body: encodedBody)
              .timeout(const Duration(seconds: 10)),
        'PATCH' =>
          await http
              .patch(uri, headers: headers, body: encodedBody)
              .timeout(const Duration(seconds: 10)),
        _ => throw UnsupportedError(method),
      };
    } on TimeoutException catch (error) {
      throw ApiUnavailable(error.toString());
    } catch (error) {
      throw ApiUnavailable(error.toString());
    }
  }

  void _captureAuth(http.Response response) {
    final rawCookie = response.headers['set-cookie'];
    if (rawCookie != null && rawCookie.isNotEmpty) {
      cookie = _cookieHeader(rawCookie);
    }
  }

  String _cookieHeader(String raw) {
    final pieces = raw.split(RegExp(r',(?=[^;,]+=)'));
    final pairs = <String>[];
    for (final piece in pieces) {
      final pair = piece.split(';').first.trim();
      if (pair.isNotEmpty) {
        pairs.add(pair);
      }
    }
    return pairs.join('; ');
  }

  ApiException _apiException(http.Response response) {
    final decoded = _tryDecode(response.body);
    var message = 'HTTP ${response.statusCode}';
    if (decoded is Map) {
      final error = decoded['error'];
      if (error is Map && error['message'] != null) {
        message = error['message'].toString();
      } else if (decoded['message'] != null) {
        message = decoded['message'].toString();
      }
    }
    return ApiException(response.statusCode, message);
  }

  dynamic _tryDecode(String body) {
    if (body.isEmpty) {
      return null;
    }
    try {
      return jsonDecode(body);
    } catch (_) {
      return body;
    }
  }

  String? _findToken(dynamic value) {
    if (value is Map) {
      for (final key in const ['token', 'accessToken', 'sessionToken']) {
        final token = value[key];
        if (token is String && token.isNotEmpty) {
          return token;
        }
      }
      for (final child in value.values) {
        final token = _findToken(child);
        if (token != null) {
          return token;
        }
      }
    }
    return null;
  }
}

class ApiException implements Exception {
  ApiException(this.statusCode, this.message);

  final int statusCode;
  final String message;

  @override
  String toString() => message;
}

class ApiUnavailable implements Exception {
  ApiUnavailable(this.message);

  final String message;
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
}

class SalesDetail {
  const SalesDetail({
    required this.id,
    required this.receiptNumber,
    required this.status,
    required this.cashierName,
    required this.subtotal,
    required this.discountTotal,
    required this.grandTotal,
    required this.grossProfit,
    required this.itemCount,
    required this.paymentMethods,
    required this.items,
    required this.payments,
    required this.createdAt,
  });

  final String id;
  final String receiptNumber;
  final String status;
  final String cashierName;
  final double subtotal;
  final double discountTotal;
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
      receiptNumber: json['receiptNumber']?.toString() ?? '-',
      status: json['status']?.toString() ?? '-',
      cashierName: json['cashierName']?.toString() ?? '',
      subtotal: _asDouble(json['subtotal']),
      discountTotal: _asDouble(json['discountTotal']),
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
}

class SalesDetailItem {
  const SalesDetailItem({
    required this.name,
    required this.quantityInput,
    required this.unitCode,
    required this.unitPrice,
    required this.lineTotal,
  });

  final String name;
  final double quantityInput;
  final String unitCode;
  final double unitPrice;
  final double lineTotal;

  factory SalesDetailItem.fromJson(Map<String, dynamic> json) {
    return SalesDetailItem(
      name: json['name']?.toString() ?? '',
      quantityInput: _asDouble(json['quantityInput']),
      unitCode: json['unitCode']?.toString() ?? 'unit',
      unitPrice: _asDouble(json['unitPrice']),
      lineTotal: _asDouble(json['lineTotal']),
    );
  }
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
}

class ReceiptLayout {
  const ReceiptLayout({
    required this.paperWidth,
    required this.autoPrint,
    required this.header,
    required this.body,
    required this.footer,
    required this.footerNote,
  });

  factory ReceiptLayout.defaultLayout() {
    return const ReceiptLayout(
      paperWidth: '58',
      autoPrint: false,
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
      header: blocks('header', fallback.header),
      body: blocks('body', fallback.body),
      footer: blocks('footer', fallback.footer),
      footerNote: json['footerNote']?.toString() ?? fallback.footerNote,
    );
  }

  final String paperWidth;
  final bool autoPrint;
  final List<String> header;
  final List<String> body;
  final List<String> footer;
  final String footerNote;

  Map<String, dynamic> toJson() => {
    'paperWidth': paperWidth,
    'autoPrint': autoPrint,
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
  });

  final String name;
  final double quantity;
  final String unitLabel;
  final double unitPrice;
  final double lineTotal;
}

class ReceiptData {
  const ReceiptData({
    required this.receiptNumber,
    required this.outletName,
    required this.cashierName,
    required this.createdAt,
    required this.lines,
    required this.subtotal,
    required this.discount,
    required this.grandTotal,
    required this.paymentMethod,
    required this.paid,
  });

  factory ReceiptData.fromCart({
    required String receiptNumber,
    required String outletName,
    required String cashierName,
    required DateTime createdAt,
    required List<CartLine> lines,
    required double subtotal,
    required double discount,
    required double grandTotal,
    required String paymentMethod,
    required double paid,
  }) {
    return ReceiptData(
      receiptNumber: receiptNumber,
      outletName: outletName,
      cashierName: cashierName,
      createdAt: createdAt,
      lines: lines
          .map(
            (line) => ReceiptLine(
              name: line.item.skuName,
              quantity: line.quantity,
              unitLabel: line.unitLabel,
              unitPrice: line.unitPrice,
              lineTotal: line.lineTotal,
            ),
          )
          .toList(),
      subtotal: subtotal,
      discount: discount,
      grandTotal: grandTotal,
      paymentMethod: paymentMethod,
      paid: paid,
    );
  }

  factory ReceiptData.fromSalesDetail(
    SalesDetail detail, {
    required String outletName,
  }) {
    return ReceiptData(
      receiptNumber: detail.receiptNumber,
      outletName: outletName,
      cashierName: detail.cashierName,
      createdAt: detail.createdAt,
      lines: detail.items
          .map(
            (line) => ReceiptLine(
              name: line.name,
              quantity: line.quantityInput,
              unitLabel: line.unitCode,
              unitPrice: line.unitPrice,
              lineTotal: line.lineTotal,
            ),
          )
          .toList(),
      subtotal: detail.subtotal,
      discount: detail.discountTotal,
      grandTotal: detail.grandTotal,
      paymentMethod: detail.paymentMethods,
      paid: detail.payments.fold(0, (sum, item) => sum + item.amount),
    );
  }

  factory ReceiptData.sample() {
    return ReceiptData(
      receiptNumber: 'TEST-PRINT',
      outletName: 'POS Cemilan',
      cashierName: 'Kasir',
      createdAt: DateTime.now(),
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
      grandTotal: 10000,
      paymentMethod: 'cash',
      paid: 10000,
    );
  }

  final String receiptNumber;
  final String outletName;
  final String cashierName;
  final DateTime createdAt;
  final List<ReceiptLine> lines;
  final double subtotal;
  final double discount;
  final double grandTotal;
  final String paymentMethod;
  final double paid;
}

class BluetoothPrinterDevice {
  const BluetoothPrinterDevice({
    required this.name,
    required this.address,
    required this.type,
  });

  factory BluetoothPrinterDevice.fromMap(Map<dynamic, dynamic> map) {
    return BluetoothPrinterDevice(
      name: map['name']?.toString() ?? '',
      address: map['address']?.toString() ?? '',
      type: map['type']?.toString() ?? 'unknown',
    );
  }

  final String name;
  final String address;
  final String type;

  String get displayName => name.trim().isEmpty ? 'Bluetooth Printer' : name;
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
}

class Outlet {
  const Outlet({
    required this.id,
    required this.name,
    required this.code,
    this.isActive = true,
  });

  final String id;
  final String name;
  final String code;
  final bool isActive;

  factory Outlet.fromJson(Map<String, dynamic> json) {
    return Outlet(
      id: json['id'].toString(),
      name: json['name']?.toString() ?? '',
      code: json['code']?.toString() ?? '',
      isActive: json['isActive'] != false,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'code': code,
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
    this.barcode,
    this.baseUnitId,
    this.baseUnitCode,
    this.onHandBaseQty = 0,
    this.reservedBaseQty = 0,
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
  final String? barcode;
  final String? baseUnitId;
  final String? baseUnitCode;
  final double onHandBaseQty;
  final double reservedBaseQty;

  double get availableBaseQty => max(0, onHandBaseQty - reservedBaseQty);
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

  factory CatalogItem.fromJson(Map<String, dynamic> json) {
    return CatalogItem(
      productId:
          json['productId']?.toString() ?? json['product_id']?.toString() ?? '',
      productName:
          json['productName']?.toString() ??
          json['product_name']?.toString() ??
          '',
      category: json['category']?.toString(),
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
      onHandBaseQty: _asDouble(json['onHandBaseQty']),
      reservedBaseQty: _asDouble(json['reservedBaseQty']),
    );
  }

  Map<String, dynamic> toJson() => {
    'productId': productId,
    'productName': productName,
    'category': category,
    'skuId': skuId,
    'skuCode': skuCode,
    'barcode': barcode,
    'skuName': skuName,
    'price': price,
    'baseUnitId': baseUnitId,
    'saleUnitId': saleUnitId,
    'saleUnitToBaseFactor': saleUnitToBaseFactor,
    'baseUnitCode': baseUnitCode,
    'onHandBaseQty': onHandBaseQty,
    'reservedBaseQty': reservedBaseQty,
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
  });

  final String id;
  final String status;
  final double expectedCash;
  final double openingCash;

  factory Shift.fromJson(Map<String, dynamic> json) {
    return Shift(
      id: json['id'].toString(),
      status: json['status']?.toString() ?? 'open',
      expectedCash: _asDouble(json['expectedCash']),
      openingCash: _asDouble(json['openingCash']),
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

  CartSession copyWith({List<CartLine>? lines}) {
    return CartSession(id: id, label: label, lines: lines ?? this.lines);
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
    );
  }

  final CatalogItem item;
  final double quantity;
  final String unitId;
  final String unitLabel;
  final double unitToBaseFactor;
  final double unitPrice;

  double get lineTotal => unitPrice * quantity;

  CartLine copyWith({
    double? quantity,
    String? unitId,
    String? unitLabel,
    double? unitToBaseFactor,
    double? unitPrice,
  }) {
    return CartLine(
      item: item,
      quantity: quantity ?? this.quantity,
      unitId: unitId ?? this.unitId,
      unitLabel: unitLabel ?? this.unitLabel,
      unitToBaseFactor: unitToBaseFactor ?? this.unitToBaseFactor,
      unitPrice: unitPrice ?? this.unitPrice,
    );
  }
}

class IndonesianNumberInputFormatter extends TextInputFormatter {
  const IndonesianNumberInputFormatter({required this.decimal});

  final bool decimal;

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final formatted = _formatInputNumber(newValue.text, decimal: decimal);
    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }
}

String _readableError(Object error) {
  if (error is ApiException) {
    return error.message;
  }
  if (error is ApiUnavailable) {
    return 'Server tidak terhubung.';
  }
  return error.toString();
}

String _formatInputNumber(String value, {required bool decimal}) {
  final allowed = decimal ? RegExp(r'[^\d,]') : RegExp(r'\D');
  final cleaned = value.replaceAll(allowed, '');
  if (cleaned.isEmpty) {
    return '';
  }
  final parts = cleaned.split(',');
  final wholeRaw = parts.first.replaceFirst(RegExp(r'^0+(?=\d)'), '');
  final whole = wholeRaw.isEmpty ? '0' : wholeRaw;
  final grouped = whole.replaceAllMapped(
    RegExp(r'\B(?=(\d{3})+(?!\d))'),
    (_) => '.',
  );
  if (decimal && cleaned.contains(',')) {
    return '$grouped,${parts.length > 1 ? parts[1] : ''}';
  }
  return grouped;
}

double _parseNumber(String value) {
  final normalized = value.replaceAll('.', '').replaceAll(',', '.').trim();
  return double.tryParse(normalized) ?? 0;
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

String _money(num value) => 'Rp ${_moneyPlain(value)}';

String _moneyPlain(num value) {
  return _formatIndonesianNumber(value, decimalDigits: 0);
}

String _qty(num value) {
  return _formatIndonesianNumber(value, decimalDigits: value % 1 == 0 ? 0 : 3);
}

String _dateTimeLabel(DateTime value) {
  final local = value.toLocal();
  final day = local.day.toString().padLeft(2, '0');
  final month = local.month.toString().padLeft(2, '0');
  final hour = local.hour.toString().padLeft(2, '0');
  final minute = local.minute.toString().padLeft(2, '0');
  return '$day/$month/${local.year} $hour:$minute';
}

String buildReceiptText(ReceiptLayout layout, ReceiptData receipt) {
  final width = layout.paperWidth == '80' ? 42 : 32;
  final separator = '-' * width;
  final lines = <String>[];
  String clip(String value) {
    if (value.length <= width) return value;
    return value.substring(0, width);
  }

  String row(String left, String right) {
    final safeRight = right.length > width ? right.substring(0, width) : right;
    final leftWidth = max(0, width - safeRight.length - 1);
    final safeLeft = left.length > leftWidth
        ? left.substring(0, leftWidth)
        : left.padRight(leftWidth);
    return '$safeLeft $safeRight';
  }

  void renderBlock(String block) {
    if (block == 'logo') lines.add('[Logo]');
    if (block == 'outlet') lines.add(clip(receipt.outletName));
    if (block == 'address') lines.add(_dateTimeLabel(receipt.createdAt));
    if (block == 'cashier') lines.add(clip('Kasir: ${receipt.cashierName}'));
    if (block == 'receiptNumber') {
      lines.add(clip('No: ${receipt.receiptNumber}'));
    }
    if (block == 'items') {
      lines.add(separator);
      for (final item in receipt.lines) {
        lines.add(clip(item.name));
        lines.add(
          row(
            '${_qty(item.quantity)} ${item.unitLabel} x ${_moneyPlain(item.unitPrice)}',
            _moneyPlain(item.lineTotal),
          ),
        );
      }
    }
    if (block == 'totals') {
      lines.add(separator);
      lines.add(row('Subtotal', _moneyPlain(receipt.subtotal)));
      if (receipt.discount > 0) {
        lines.add(row('Diskon', _moneyPlain(receipt.discount)));
      }
      lines.add(row('TOTAL', _moneyPlain(receipt.grandTotal)));
    }
    if (block == 'payment') {
      lines.add(row(receipt.paymentMethod, _moneyPlain(receipt.paid)));
      if (receipt.paid > receipt.grandTotal) {
        lines.add(
          row('Kembali', _moneyPlain(receipt.paid - receipt.grandTotal)),
        );
      }
    }
    if (block == 'note') {
      lines.add(separator);
      lines.add(clip(layout.footerNote));
    }
  }

  for (final block in layout.header) {
    renderBlock(block);
  }
  for (final block in layout.body) {
    renderBlock(block);
  }
  for (final block in layout.footer) {
    renderBlock(block);
  }
  return '${lines.join('\n')}\n';
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

extension FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull {
    final iterator = this.iterator;
    if (iterator.moveNext()) {
      return iterator.current;
    }
    return null;
  }
}
