import 'package:flutter/material.dart';
import 'package:pos_cemilan_kasir/core/theme/app_palette.dart';

/// Animated pending sync badge — pulses when there are pending transactions.
class SyncBadge extends StatefulWidget {
  const SyncBadge({
    super.key,
    required this.pendingCount,
    this.label = 'Sinkronisasi',
    this.icon = Icons.sync,
    this.onTap,
  });

  final int pendingCount;
  final String label;
  final IconData icon;
  final VoidCallback? onTap;

  @override
  State<SyncBadge> createState() => _SyncBadgeState();
}

class _SyncBadgeState extends State<SyncBadge> with SingleTickerProviderStateMixin {
  late AnimationController _pulse;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    if (widget.pendingCount > 0) {
      _pulse.repeat(reverse: true);
    }
  }

  @override
  void didUpdateWidget(SyncBadge old) {
    super.didUpdateWidget(old);
    if (widget.pendingCount > 0 && !_pulse.isAnimating) {
      _pulse.repeat(reverse: true);
    } else if (widget.pendingCount == 0 && _pulse.isAnimating) {
      _pulse.stop();
      _pulse.value = 0;
    }
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.pendingCount == 0) {
      return InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: widget.onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(widget.icon, size: 18, color: AppPalette.slate),
              const SizedBox(width: 6),
              Text(widget.label,
                style: const TextStyle(
                  fontSize: 12, fontWeight: FontWeight.w600, color: AppPalette.slate)),
            ],
          ),
        ),
      );
    }

    return AnimatedBuilder(
      animation: _pulse,
      builder: (context, child) {
        final opacity = 0.7 + (_pulse.value * 0.3);
        return InkWell(
          borderRadius: BorderRadius.circular(8),
          onTap: widget.onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: AppPalette.amber.withValues(alpha: opacity * 0.15),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(widget.icon, size: 18,
                  color: AppPalette.amber.withValues(alpha: opacity)),
                const SizedBox(width: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppPalette.amber.withValues(alpha: opacity * 0.9),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    '${widget.pendingCount}',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                ),
                const SizedBox(width: 4),
                Text(
                  widget.label,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppPalette.amber.withValues(alpha: opacity),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
