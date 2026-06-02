import 'dart:convert';

import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:pos_cemilan_kasir/features/home/data/pos_api.dart';
import 'package:pos_cemilan_kasir/features/home/models/pos_models.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum AuthStatus { booting, signedOut, signedIn }

class AuthState {
  const AuthState({
    required this.status,
    required this.isBusy,
    required this.isOnline,
    required this.baseUrl,
    required this.message,
    this.currentUser,
    this.prefs,
  });

  factory AuthState.initial(String defaultBaseUrl) {
    return AuthState(
      status: AuthStatus.booting,
      isBusy: false,
      isOnline: false,
      baseUrl: defaultBaseUrl,
      message: '',
    );
  }

  final AuthStatus status;
  final bool isBusy;
  final bool isOnline;
  final String baseUrl;
  final String message;
  final CurrentUser? currentUser;
  final SharedPreferences? prefs;

  bool get isBooting => status == AuthStatus.booting;
  bool get isSignedIn => status == AuthStatus.signedIn;

  AuthState copyWith({
    AuthStatus? status,
    bool? isBusy,
    bool? isOnline,
    String? baseUrl,
    String? message,
    CurrentUser? currentUser,
    bool clearCurrentUser = false,
    SharedPreferences? prefs,
  }) {
    return AuthState(
      status: status ?? this.status,
      isBusy: isBusy ?? this.isBusy,
      isOnline: isOnline ?? this.isOnline,
      baseUrl: baseUrl ?? this.baseUrl,
      message: message ?? this.message,
      currentUser: clearCurrentUser ? null : (currentUser ?? this.currentUser),
      prefs: prefs ?? this.prefs,
    );
  }
}

class AuthCubit extends Cubit<AuthState> {
  AuthCubit({required String defaultBaseUrl})
    : _api = PosApi(baseUrl: defaultBaseUrl),
      super(AuthState.initial(defaultBaseUrl));

  static const baseUrlKey = 'base_url';
  static const cookieKey = 'auth_cookie';
  static const bearerKey = 'auth_bearer';
  static const offlineEmailKey = 'offline_login_email';
  static const offlinePasswordKey = 'offline_login_password';
  static const offlineUserNameKey = 'offline_login_user_name';
  static const offlineUserRoleKey = 'offline_login_user_role';
  static const cachedProfileKey = 'cached_profile';

  PosApi _api;
  SharedPreferences? _prefs;

  PosApi get api => _api;
  SharedPreferences? get prefs => _prefs;

  Future<void> bootstrap() async {
    final prefs = await SharedPreferences.getInstance();
    _prefs = prefs;
    final baseUrl = prefs.getString(baseUrlKey) ?? state.baseUrl;
    final cookie = prefs.getString(cookieKey) ?? '';
    final bearer = prefs.getString(bearerKey) ?? '';
    final cachedProfile = _decodeCachedProfile();
    _api = PosApi(baseUrl: baseUrl, cookie: cookie, bearer: bearer);
    final isSignedIn = cookie.isNotEmpty || bearer.isNotEmpty;

    emit(
      state.copyWith(
        prefs: prefs,
        baseUrl: baseUrl,
        status: isSignedIn ? AuthStatus.signedIn : AuthStatus.signedOut,
        currentUser: cachedProfile,
        isOnline: false,
        message: '',
      ),
    );

    if (!isSignedIn) {
      return;
    }

    await loadProfile(showErrors: false);
  }

  Future<void> signIn({
    required String baseUrl,
    required String email,
    required String password,
  }) async {
    emit(state.copyWith(isBusy: true, message: ''));
    _api = PosApi(baseUrl: baseUrl);

    try {
      await _api.signIn(email, password);
      await _prefs?.setString(baseUrlKey, _api.baseUrl);
      await _prefs?.setString(cookieKey, _api.cookie);
      await _prefs?.setString(bearerKey, _api.bearer);
      emit(
        state.copyWith(
          status: AuthStatus.signedIn,
          baseUrl: _api.baseUrl,
          isOnline: true,
          message: 'Login berhasil.',
        ),
      );
      await loadProfile();
      await _rememberOfflineLogin(email: email, password: password);
    } on ApiUnavailable catch (_) {
      try {
        await _signInOffline(email: email, password: password);
      } catch (error) {
        emit(
          state.copyWith(message: 'Login gagal. ${readableApiError(error)}'),
        );
      }
    } catch (error) {
      emit(state.copyWith(message: 'Login gagal. ${readableApiError(error)}'));
    } finally {
      emit(state.copyWith(isBusy: false));
    }
  }

  Future<void> loadProfile({bool showErrors = true}) async {
    try {
      final profile = await _api.fetchProfile();
      await _cacheProfile(profile);
      emit(
        state.copyWith(
          currentUser: profile,
          isOnline: true,
          message: state.message,
        ),
      );
    } catch (error) {
      emit(
        state.copyWith(
          currentUser: _decodeCachedProfile(),
          isOnline: _serverReachableAfter(error),
          message: showErrors
              ? 'Profil kasir belum bisa dimuat. ${readableApiError(error)}'
              : state.message,
        ),
      );
    }
  }

  Future<void> saveUserSettings({
    required String name,
    required String currentPassword,
    required String newPassword,
    required String confirmPassword,
  }) async {
    if (name.isEmpty) {
      emit(state.copyWith(message: 'Nama kasir wajib diisi.'));
      return;
    }
    if (newPassword.isNotEmpty) {
      if (newPassword.length < 8) {
        emit(state.copyWith(message: 'Password baru minimal 8 karakter.'));
        return;
      }
      if (currentPassword.isEmpty) {
        emit(state.copyWith(message: 'Password lama wajib diisi.'));
        return;
      }
      if (newPassword != confirmPassword) {
        emit(state.copyWith(message: 'Konfirmasi password baru tidak sama.'));
        return;
      }
    }

    emit(state.copyWith(isBusy: true, message: ''));
    try {
      final updated = await _api.updateProfile(name);
      await _cacheProfile(updated);
      if (newPassword.isNotEmpty) {
        await _api.changePassword(
          currentPassword: currentPassword,
          newPassword: newPassword,
        );
        await _prefs?.setString(cookieKey, _api.cookie);
        await _prefs?.setString(bearerKey, _api.bearer);
      }
      emit(
        state.copyWith(
          currentUser: updated,
          isOnline: true,
          message: newPassword.isNotEmpty
              ? 'Nama dan password kasir berhasil diperbarui.'
              : 'Nama kasir berhasil diperbarui.',
        ),
      );
    } catch (error) {
      emit(
        state.copyWith(
          isOnline: _serverReachableAfter(error),
          message: 'Update setting user gagal. ${readableApiError(error)}',
        ),
      );
    } finally {
      emit(state.copyWith(isBusy: false));
    }
  }

  Future<void> saveBaseUrl(String value) async {
    final trimmed = value.trim();
    if (trimmed.isEmpty) {
      return;
    }
    _api = PosApi(baseUrl: trimmed, cookie: _api.cookie, bearer: _api.bearer);
    await _prefs?.setString(baseUrlKey, _api.baseUrl);
    emit(state.copyWith(baseUrl: _api.baseUrl, message: 'Base URL disimpan.'));
  }

  Future<void> logout({String message = 'Sesi kasir keluar.'}) async {
    await _prefs?.remove(cookieKey);
    await _prefs?.remove(bearerKey);
    _api = PosApi(baseUrl: state.baseUrl);
    emit(
      state.copyWith(
        status: AuthStatus.signedOut,
        isOnline: false,
        message: message,
        clearCurrentUser: true,
      ),
    );
  }

  Future<void> _rememberOfflineLogin({
    required String email,
    required String password,
  }) async {
    final user = state.currentUser;
    await _prefs?.setString(offlineEmailKey, email);
    await _prefs?.setString(offlinePasswordKey, password);
    if (user != null) {
      await _cacheProfile(user);
      await _prefs?.setString(offlineUserNameKey, user.name);
      await _prefs?.setString(offlineUserRoleKey, user.role);
    }
  }

  Future<void> _signInOffline({
    required String email,
    required String password,
  }) async {
    final savedEmail = _prefs?.getString(offlineEmailKey) ?? '';
    final savedPassword = _prefs?.getString(offlinePasswordKey) ?? '';
    if (email.isEmpty ||
        password.isEmpty ||
        email != savedEmail ||
        password != savedPassword) {
      throw ApiUnavailable(
        'Server tidak terhubung dan data login offline belum cocok. Login online sekali dulu saat server tersedia.',
      );
    }

    emit(
      state.copyWith(
        status: AuthStatus.signedIn,
        isOnline: false,
        currentUser:
            _decodeCachedProfile() ??
            CurrentUser(
              id: 'offline',
              name: _prefs?.getString(offlineUserNameKey) ?? email,
              email: email,
              role: _prefs?.getString(offlineUserRoleKey) ?? 'cashier',
            ),
        message:
            'Login offline berhasil. Transaksi akan disimpan antrean sync.',
      ),
    );
  }

  Future<void> _cacheProfile(CurrentUser user) async {
    await _prefs?.setString(cachedProfileKey, jsonEncode(user.toJson()));
  }

  CurrentUser? _decodeCachedProfile() {
    final raw = _prefs?.getString(cachedProfileKey);
    if (raw == null || raw.isEmpty) return null;
    try {
      return CurrentUser.fromJson(Map<String, dynamic>.from(jsonDecode(raw)));
    } catch (_) {
      return null;
    }
  }
}

String readableApiError(Object error) {
  if (error is ApiException) {
    return error.message;
  }
  if (error is ApiUnavailable) {
    return 'Server tidak terhubung.';
  }
  return error.toString();
}

bool _serverReachableAfter(Object error) => error is! ApiUnavailable;
