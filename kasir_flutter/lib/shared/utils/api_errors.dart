// API Error models — shared across all API clients.

/// Thrown when the server returns a non-2xx response.
class ApiException implements Exception {
  ApiException(this.statusCode, this.message);

  final int statusCode;
  final String message;

  @override
  String toString() => message;

  /// Whether this error is caused by subscription (payment required / forbidden).
  bool get isSubscriptionError =>
      statusCode == 402 || statusCode == 403;

  /// Whether this error tells us the server is reachable but rejecting the request.
  bool get isServerReachable => statusCode >= 400;
}

/// Thrown when the server is unreachable (network timeout, connection refused).
class ApiUnavailable implements Exception {
  ApiUnavailable(this.message);

  final String message;
}

/// Extract a human-readable message from any error.
String readableApiError(Object error) {
  if (error is ApiException) {
    return error.message;
  }
  if (error is ApiUnavailable) {
    return 'Server tidak terhubung.';
  }
  return error.toString();
}

/// Whether this error indicates the server is reachable.
bool serverReachableAfter(Object error) => error is! ApiUnavailable;
