import 'package:flutter/material.dart';
import 'package:pos_cemilan_kasir/core/theme/app_palette.dart';

/// Compact shift status indicator — tells cashier if shift is open/closed at a glance.
class ShiftIndicator extends StatelessWidget {
  const ShiftIndicator({
    super.key,
    required this.isShiftOpen,
    this.expectedCash = 0,
    this.onOpen,
    this.onClose,
    this.isBusy = false,
  });

  final bool isShiftOpen;
  final double expectedCash;
  final VoidCallback? onOpen;
  final VoidCallback? onClose;
  final bool isBusy;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: isShiftOpen
            ? AppPalette.success.withValues(alpha: 0.08)
            : AppPalette.red.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isShiftOpen
              ? AppPalette.success.withValues(alpha: 0.22)
              : AppPalette.red.withValues(alpha: 0.22),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isShiftOpen ? AppPalette.success : AppPalette.red,
              boxShadow: [
                BoxShadow(
                  color: (isShiftOpen ? AppPalette.success : AppPalette.red)
                      .withValues(alpha: 0.4),
                  blurRadius: 6,
                  spreadRadius: 1,
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              isShiftOpen
                  ? 'Shift aktif'
                  : 'Shift belum dibuka',
              style: TextStyle(
                fontWeight: FontWeight.w800,
                color: isShiftOpen ? AppPalette.success : AppPalette.red,
                fontSize: 13,
              ),
            ),
          ),
          if (isShiftOpen && onClose != null)
            TextButton.icon(
              onPressed: isBusy ? null : onClose,
              icon: Icon(Icons.lock_outline, size: 16,
                color: AppPalette.red.withValues(alpha: 0.75)),
              label: Text('Tutup',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppPalette.red.withValues(alpha: 0.85),
                )),
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
            )
          else if (!isShiftOpen && onOpen != null)
            FilledButton.icon(
              onPressed: isBusy ? null : onOpen,
              icon: const Icon(Icons.play_arrow, size: 16),
              label: const Text('Buka', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
              style: FilledButton.styleFrom(
                backgroundColor: AppPalette.success,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
        ],
      ),
    );
  }
}
