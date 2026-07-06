import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:pos_cemilan_kasir/features/home/models/pos_models.dart';
import 'package:pos_cemilan_kasir/shared/utils/api_errors.dart';

class PosApi {
  PosApi({required String baseUrl, this.cookie = '', this.bearer = ''})
    : baseUrl = _normalizeBaseUrl(baseUrl);

  static const mobileOrigin = 'pos://mobile';

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

  Future<void> signOut() async {
    try {
      await _send('POST', '/api/auth/sign-out', body: <String, dynamic>{});
    } finally {
      cookie = '';
      bearer = '';
    }
  }

  Map<String, String> assetHeaders() {
    return {
      'Accept': '*/*',
      if (cookie.isNotEmpty) 'Cookie': cookie,
      if (bearer.isNotEmpty) 'Authorization': 'Bearer $bearer',
    };
  }

  Future<bool> checkHealth() async {
    try {
      final response = await http
          .get(
            Uri.parse('$baseUrl/api/health'),
            headers: {'Accept': 'application/json'},
          )
          .timeout(const Duration(seconds: 2));
      return response.statusCode >= 200 && response.statusCode < 300;
    } catch (_) {
      return false;
    }
  }

  Stream<RealtimeEvent> realtimeEvents() async* {
    final client = http.Client();
    try {
      final request = http.Request('GET', Uri.parse('$baseUrl/api/realtime'));
      request.headers.addAll({
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Origin': mobileOrigin,
        'Referer': '$mobileOrigin/',
        if (cookie.isNotEmpty) 'Cookie': cookie,
        if (bearer.isNotEmpty) 'Authorization': 'Bearer $bearer',
      });
      final response = await client
          .send(request)
          .timeout(const Duration(seconds: 10));
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw ApiException(response.statusCode, 'HTTP ${response.statusCode}');
      }

      final lines = response.stream
          .transform(utf8.decoder)
          .transform(const LineSplitter());
      final dataLines = <String>[];
      await for (final line in lines) {
        if (line.isEmpty) {
          final rawData = dataLines.join('\n');
          dataLines.clear();
          if (rawData.isEmpty) continue;
          final decoded = _tryDecode(rawData);
          if (decoded is Map) {
            yield RealtimeEvent.fromJson(Map<String, dynamic>.from(decoded));
          }
          continue;
        }
        if (line.startsWith(':')) continue;
        if (line.startsWith('data:')) {
          dataLines.add(line.substring(5).trimLeft());
        }
      }
    } on TimeoutException catch (error) {
      throw ApiUnavailable(error.toString());
    } catch (error) {
      if (error is ApiException || error is ApiUnavailable) rethrow;
      throw ApiUnavailable(error.toString());
    } finally {
      client.close();
    }
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

  Future<List<Customer>> fetchCustomers() async {
    final data = await _request('GET', '/api/customers');
    final rows = data is Map
        ? ((data['items'] as List?) ?? [])
        : (data as List);
    return rows
        .map((item) => Customer.fromJson(Map<String, dynamic>.from(item)))
        .where((item) => item.isActive)
        .toList();
  }

  Future<CurrentUser> updateProfile(String name) async {
    final data = await _request('PATCH', '/api/profile', body: {'name': name});
    return CurrentUser.fromJson(Map<String, dynamic>.from(data));
  }

  Future<ReceiptLayout> fetchReceiptLayout() async {
    final data = await _request('GET', '/api/settings');
    if (data is Map) {
      final layout = data['receiptLayout'] is Map
          ? Map<String, dynamic>.from(data['receiptLayout'] as Map)
          : <String, dynamic>{};
      final defaultLogo = data['defaultOutletLogoUrl'];
      if (defaultLogo != null) {
        layout['defaultOutletLogoUrl'] = defaultLogo.toString();
      }
      return ReceiptLayout.fromJson(layout);
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

  Future<Shift> closeShift(
    String shiftId,
    double actualCash, {
    String? varianceReason,
  }) async {
    final data = await _request(
      'POST',
      '/api/shifts/close',
      body: {
        'shiftId': shiftId,
        'actualCash': actualCash,
        if (varianceReason != null && varianceReason.trim().isNotEmpty)
          'varianceReason': varianceReason.trim(),
      },
    );
    return Shift.fromJson(Map<String, dynamic>.from(data));
  }

  Future<ShiftSummary> fetchShiftSummary(String shiftId) async {
    final data = await _request('GET', '/api/shifts/$shiftId/summary');
    return ShiftSummary.fromJson(Map<String, dynamic>.from(data));
  }

  Future<void> createCashMovement({
    required String shiftId,
    required String type,
    required double amount,
    required String reason,
    String? note,
  }) async {
    await _request(
      'POST',
      '/api/shifts/cash-movements',
      body: {
        'shiftId': shiftId,
        'type': type,
        'amount': amount,
        'reason': reason,
        if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
      },
    );
  }

  Future<Map<String, dynamic>> createSale(Map<String, dynamic> payload) async {
    final data = await _request('POST', '/api/sales', body: payload);
    if (data is Map) {
      return Map<String, dynamic>.from(data);
    }
    return {};
  }

  Future<SaleQuote> quoteSale(Map<String, dynamic> payload) async {
    final data = await _request('POST', '/api/sales/quote', body: payload);
    return SaleQuote.fromJson(Map<String, dynamic>.from(data as Map));
  }

  Future<List<PromotionRule>> fetchActivePromotions() async {
    final data = await _request('GET', '/api/promotions/active');
    final rows = data is Map
        ? ((data['items'] as List?) ?? [])
        : (data as List);
    return rows
        .map((item) => PromotionRule.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  Future<void> createWasteAdjustment({
    required String outletId,
    required String skuId,
    required double quantity,
    required String unitId,
    required String reason,
    String? idempotencyKey,
    String? note,
  }) async {
    await _request(
      'POST',
      '/api/waste-adjustments',
      body: {
        'outletId': outletId,
        'skuId': skuId,
        if (idempotencyKey != null && idempotencyKey.isNotEmpty)
          'idempotencyKey': idempotencyKey,
        'quantity': quantity,
        'unitId': unitId,
        'reason': reason,
        if (note != null && note.isNotEmpty) 'note': note,
      },
    );
  }

  Future<void> voidSale({
    required String saleId,
    required String reason,
  }) async {
    await _request('POST', '/api/sales/$saleId/void', body: {'reason': reason});
  }

  Future<void> refundSale({
    required String saleId,
    required String reason,
    required bool restock,
    String? refundMethod,
  }) async {
    await _request(
      'POST',
      '/api/sales/$saleId/refund',
      body: {
        'reason': reason,
        'restock': restock,
        if (refundMethod != null && refundMethod.isNotEmpty)
          'refundMethod': refundMethod,
      },
    );
  }

  Future<List<PendingVarianceShift>> pendingVarianceShifts(
    String outletId,
  ) async {
    final data = await _request(
      'GET',
      '/api/shifts/pending-variance?outletId=$outletId',
    );
    return (data as List)
        .map(
          (item) =>
              PendingVarianceShift.fromJson(Map<String, dynamic>.from(item)),
        )
        .toList();
  }

  Future<void> approveShiftVariance(String shiftId) async {
    await _request('POST', '/api/shifts/$shiftId/approve-variance');
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
      'Origin': mobileOrigin,
      'Referer': '$mobileOrigin/',
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

// ApiException, ApiUnavailable, readableApiError — imported from api_errors.dart
