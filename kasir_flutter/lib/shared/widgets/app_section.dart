import 'package:flutter/material.dart';
import 'package:pos_cemilan_kasir/core/theme/app_palette.dart';

class AppSection extends StatefulWidget {
  const AppSection({
    super.key,
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
  State<AppSection> createState() => _AppSectionState();
}

class _AppSectionState extends State<AppSection> {
  late var _isExpanded = widget.initiallyExpanded;

  @override
  Widget build(BuildContext context) {
    final content = widget.isLoading
        ? SectionLoading(text: widget.loadingText)
        : widget.child;
    final body = widget.fillBody ? Expanded(child: content) : content;
    final showBody = !widget.collapsible || _isExpanded;
    final header = Container(
      color: AppPalette.white,
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
      child: Row(
        children: [
          if (widget.icon != null) ...[
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: widget.headerColor.withValues(alpha: 0.09),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: widget.headerColor.withValues(alpha: 0.16),
                ),
              ),
              child: Icon(widget.icon, color: widget.headerColor, size: 20),
            ),
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
                    color: AppPalette.navy,
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                if (widget.subtitle != null)
                  Text(
                    widget.subtitle!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppPalette.slate,
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
                color: AppPalette.navy,
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

class SectionLoading extends StatelessWidget {
  const SectionLoading({super.key, required this.text});

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
          const LoadingBar(widthFactor: 0.9),
          const SizedBox(height: 8),
          const LoadingBar(widthFactor: 0.7),
          const SizedBox(height: 8),
          const LoadingBar(widthFactor: 0.82),
        ],
      ),
    );
  }
}

class LoadingBar extends StatelessWidget {
  const LoadingBar({super.key, required this.widthFactor});

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

class SectionBadge extends StatelessWidget {
  const SectionBadge({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppPalette.mist,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppPalette.line),
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
