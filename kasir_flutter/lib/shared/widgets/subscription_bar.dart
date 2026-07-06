import 'package:flutter/material.dart';
import 'package:pos_cemilan_kasir/core/theme/app_palette.dart';

/// Thin subscription status bar — always visible when subscription needs attention.
class SubscriptionStatusBar extends StatelessWidget {
  const SubscriptionStatusBar({
    super.key,
    this.planName = '',
    this.status = '',
    this.isTrial = false,
    this.isGrace = false,
    this.isExpired = false,
    this.trialDaysLeft = 0,
  });

  final String planName;
  final String status;
  final bool isTrial;
  final bool isGrace;
  final bool isExpired;
  final int trialDaysLeft;

  @override
  Widget build(BuildContext context) {
    // Don't show anything if subscription is healthy (active, no issues)
    if (!isTrial && !isGrace && !isExpired && status != 'trial') {
      return const SizedBox.shrink();
    }

    final Color bg;
    final Color fg;
    final IconData icon;
    final String message;

    if (isExpired) {
      bg = AppPalette.red.withValues(alpha: 0.12);
      fg = AppPalette.red;
      icon = Icons.error_outline;
      message = 'Langganan berakhir — Hubungi IT Support';
    } else if (isGrace) {
      bg = AppPalette.amber.withValues(alpha: 0.12);
      fg = AppPalette.amber;
      icon = Icons.access_time;
      message = 'Masa tenggang — Segera perpanjang';
    } else if (isTrial && trialDaysLeft > 0) {
      bg = AppPalette.blue.withValues(alpha: 0.08);
      fg = AppPalette.blue;
      icon = Icons.new_releases;
      message = 'Uji coba • $trialDaysLeft hari tersisa';
    } else if (status == 'trial') {
      bg = AppPalette.amber.withValues(alpha: 0.12);
      fg = AppPalette.amber;
      icon = Icons.access_time;
      message = 'Masa uji coba berakhir';
    } else {
      return const SizedBox.shrink();
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      color: bg,
      child: Row(
        children: [
          Icon(icon, size: 16, color: fg),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: fg,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
