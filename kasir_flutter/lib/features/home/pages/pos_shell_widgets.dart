part of 'pos_shell_page.dart';

class _LocalPromotionResult {
  const _LocalPromotionResult({
    required this.discountTotal,
    required this.appliedPromotions,
    required this.promotionIssues,
  });

  final double discountTotal;
  final List<AppliedPromotion> appliedPromotions;
  final List<PromotionIssue> promotionIssues;
}

class _QuantityEditDialog extends StatefulWidget {
  const _QuantityEditDialog({
    required this.productName,
    required this.unitLabel,
    required this.initialValue,
  });

  final String productName;
  final String unitLabel;
  final String initialValue;

  @override
  State<_QuantityEditDialog> createState() => _QuantityEditDialogState();
}

class _QuantityEditDialogState extends State<_QuantityEditDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialValue);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    void submit() {
      if (!(_formKey.currentState?.validate() ?? false)) {
        return;
      }
      FocusScope.of(context).unfocus();
      Navigator.pop(context, _parseNumber(_controller.text));
    }

    return AlertDialog(
      title: Text(widget.productName),
      content: Form(
        key: _formKey,
        child: TextFormField(
          controller: _controller,
          autofocus: true,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          inputFormatters: const [
            IndonesianNumberInputFormatter(decimal: true),
          ],
          textInputAction: TextInputAction.done,
          onFieldSubmitted: (_) => submit(),
          validator: (value) {
            final quantity = _parseNumber(value ?? '');
            if (quantity <= 0) {
              return 'Qty harus lebih dari 0.';
            }
            return null;
          },
          decoration: InputDecoration(
            labelText: 'Qty ${widget.unitLabel}',
            hintText: '1',
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () {
            FocusScope.of(context).unfocus();
            Navigator.pop(context);
          },
          child: const Text('Batal'),
        ),
        FilledButton(onPressed: submit, child: const Text('Simpan')),
      ],
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
              ? '$outletName - Shift aktif - ${_money(expectedCash ?? 0)}'
              : '$outletName - Shift belum dibuka',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            color: AppPalette.slate,
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
            color: online ? AppPalette.blue : AppPalette.red,
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
    return AppSection(
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
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final compact = constraints.maxWidth < 620;
            final outletField = DropdownButtonFormField<String>(
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
                      child: Text(outlet.name, overflow: TextOverflow.ellipsis),
                    ),
                  )
                  .toList(),
              onChanged: (value) {
                if (value != null) onSelectOutlet(value);
              },
            );
            final status = _ShiftStatusBadge(shift: shift);
            final cashField = TextField(
              controller: shift == null
                  ? openingCashController
                  : actualCashController,
              keyboardType: TextInputType.number,
              inputFormatters: const [
                IndonesianNumberInputFormatter(decimal: false),
              ],
              decoration: InputDecoration(
                labelText: shift == null ? 'Modal awal' : 'Kas aktual',
                prefixIcon: Icon(
                  shift == null
                      ? Icons.payments_outlined
                      : Icons.fact_check_outlined,
                ),
              ),
            );
            final action = shift == null
                ? FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: AppPalette.blue,
                      foregroundColor: AppPalette.white,
                    ),
                    onPressed: onOpenShift,
                    icon: const Icon(Icons.lock_open_outlined),
                    label: const Text('Buka Shift'),
                  )
                : OutlinedButton.icon(
                    onPressed: onCloseShift,
                    icon: const Icon(Icons.lock_outline),
                    label: const Text('Tutup Shift'),
                  );

            if (compact) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(child: outletField),
                      const SizedBox(width: 8),
                      status,
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(child: cashField),
                      const SizedBox(width: 8),
                      Flexible(child: action),
                    ],
                  ),
                ],
              );
            }

            return Row(
              children: [
                Expanded(flex: 3, child: outletField),
                const SizedBox(width: 10),
                status,
                const SizedBox(width: 10),
                Expanded(flex: 2, child: cashField),
                const SizedBox(width: 10),
                action,
              ],
            );
          },
        ),
      ),
    );
  }
}

class _ShiftStatusBadge extends StatelessWidget {
  const _ShiftStatusBadge({required this.shift});

  final Shift? shift;

  @override
  Widget build(BuildContext context) {
    final active = shift != null;
    return Container(
      constraints: const BoxConstraints(minHeight: 48),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: active
            ? AppPalette.aqua
            : AppPalette.red.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: active
              ? AppPalette.blue.withValues(alpha: 0.28)
              : AppPalette.red.withValues(alpha: 0.2),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            active ? Icons.lock_open_outlined : Icons.lock_outline,
            size: 18,
            color: active ? AppPalette.blue : AppPalette.red,
          ),
          const SizedBox(width: 6),
          Text(
            active ? 'Aktif' : 'Tutup',
            style: TextStyle(
              color: active ? AppPalette.blue : AppPalette.red,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
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
    if (isLoading) {
      return const Card(
        child: SectionLoading(text: 'Memuat katalog produk...'),
      );
    }
    return Card(
      child: LayoutBuilder(
        builder: (context, constraints) {
          final width = max(0.0, constraints.maxWidth - 24);
          final tileHeight = width < 600 ? 214.0 : 190.0;
          return Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Katalog',
                        style: TextStyle(
                          color: AppPalette.navy,
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    SectionBadge(text: '${items.length} SKU'),
                  ],
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: searchController,
                  onChanged: (_) => onSearchChanged(),
                  decoration: const InputDecoration(
                    hintText: 'Cari nama, SKU, barcode, kategori',
                    prefixIcon: Icon(Icons.search),
                  ),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  height: 38,
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
                const SizedBox(height: 12),
                Expanded(
                  child: items.isEmpty
                      ? const Center(child: Text('Belum ada produk.'))
                      : GridView.builder(
                          itemCount: items.length,
                          gridDelegate:
                              SliverGridDelegateWithMaxCrossAxisExtent(
                                maxCrossAxisExtent: 220,
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
                        ),
                ),
              ],
            ),
          );
        },
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
    final radius = BorderRadius.circular(8);
    return ClipRRect(
      borderRadius: radius,
      child: InkWell(
        onTap: onAdd,
        borderRadius: radius,
        child: Ink(
          decoration: BoxDecoration(
            border: Border.all(color: AppPalette.line),
            borderRadius: radius,
            color: AppPalette.white,
          ),
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    _ProductIcon(lowStock: lowStock),
                    const Spacer(),
                    IconButton.filledTonal(
                      tooltip: 'Tambah',
                      onPressed: onAdd,
                      icon: const Icon(Icons.add),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Expanded(child: _ProductTileText(item: item)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ProductIcon extends StatelessWidget {
  const _ProductIcon({required this.lowStock});

  final bool lowStock;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 42,
      height: 42,
      decoration: BoxDecoration(
        color: lowStock
            ? AppPalette.red.withValues(alpha: 0.10)
            : AppPalette.aqua,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Icon(
        lowStock ? Icons.inventory_2_outlined : Icons.fastfood_outlined,
        color: lowStock ? AppPalette.red : AppPalette.blue,
      ),
    );
  }
}

class _ProductTileText extends StatelessWidget {
  const _ProductTileText({required this.item});

  final CatalogItem item;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          item.skuName,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 5),
        Text(
          _money(item.price),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            color: Theme.of(context).colorScheme.primary,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 5),
        Text(
          item.category?.isNotEmpty == true ? item.category! : item.skuCode,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: AppPalette.navy.withValues(alpha: 0.72),
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 8),
        const Spacer(),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
          decoration: BoxDecoration(
            color: AppPalette.aqua.withValues(alpha: 0.28),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text(
            'Stok ${_qty(item.availableBaseQty)} ${item.baseUnitCode ?? 'unit'}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(
              context,
            ).textTheme.labelSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
        ),
      ],
    );
  }
}

class _CartPane extends StatelessWidget {
  const _CartPane({
    required this.lines,
    required this.sessions,
    required this.activeSessionId,
    required this.subtotal,
    required this.discountTotal,
    required this.donationTotal,
    required this.roundingTotal,
    required this.grandTotal,
    required this.isQuoteLoading,
    required this.promotionCodeController,
    required this.paymentMethods,
    required this.paymentAmountControllers,
    required this.paidTotal,
    required this.changeTotal,
    required this.pendingCount,
    required this.onPaymentMethodChanged,
    required this.onPaymentAmountChanged,
    required this.onPromotionChanged,
    required this.onAddPayment,
    required this.onRemovePayment,
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
  final double discountTotal;
  final double donationTotal;
  final double roundingTotal;
  final double grandTotal;
  final bool isQuoteLoading;
  final TextEditingController promotionCodeController;
  final List<String> paymentMethods;
  final List<TextEditingController> paymentAmountControllers;
  final double paidTotal;
  final double changeTotal;
  final int pendingCount;
  final void Function(int index, String method) onPaymentMethodChanged;
  final VoidCallback onPaymentAmountChanged;
  final VoidCallback onPromotionChanged;
  final VoidCallback onAddPayment;
  final ValueChanged<int> onRemovePayment;
  final ValueChanged<String> onSessionChanged;
  final VoidCallback onNewSession;
  final VoidCallback onCloseSession;
  final void Function(CartLine line, double quantity) onQuantityChanged;
  final void Function(CartLine line, UnitChoice unit) onUnitChanged;
  final ValueChanged<CartLine> onEditQuantity;
  final VoidCallback? onCheckout;

  @override
  Widget build(BuildContext context) {
    return AppSection(
      title: 'Keranjang',
      subtitle: '${lines.length} item dalam transaksi aktif',
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
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 6),
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
                    padding: const EdgeInsets.fromLTRB(10, 4, 10, 6),
                    itemCount: lines.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
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
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (isQuoteLoading) ...[
                  const LinearProgressIndicator(minHeight: 2),
                  const SizedBox(height: 8),
                ],
                _TotalRow(label: 'Subtotal', value: _money(subtotal)),
                if (discountTotal > 0)
                  _TotalRow(
                    label: 'Diskon',
                    value: '-${_money(discountTotal)}',
                  ),
                if (donationTotal > 0)
                  _TotalRow(label: 'Donasi', value: _money(donationTotal)),
                if (roundingTotal > 0)
                  _TotalRow(label: 'Pembulatan', value: _money(roundingTotal)),
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
                      Text('$pendingCount data menunggu sync'),
                    ],
                  ),
                ],
                const SizedBox(height: 10),
                _CartCheckoutBar(
                  promotionCodeController: promotionCodeController,
                  enabled: lines.isNotEmpty,
                  onPromotionChanged: onPromotionChanged,
                  onCheckout: lines.isEmpty ? null : onCheckout,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CartCheckoutBar extends StatelessWidget {
  const _CartCheckoutBar({
    required this.promotionCodeController,
    required this.enabled,
    required this.onPromotionChanged,
    required this.onCheckout,
  });

  final TextEditingController promotionCodeController;
  final bool enabled;
  final VoidCallback onPromotionChanged;
  final VoidCallback? onCheckout;

  @override
  Widget build(BuildContext context) {
    final promoField = TextField(
      controller: promotionCodeController,
      enabled: enabled,
      textCapitalization: TextCapitalization.characters,
      textInputAction: TextInputAction.done,
      onChanged: (_) => onPromotionChanged(),
      decoration: const InputDecoration(
        labelText: 'Kode promo',
        hintText: 'PROMO',
        prefixIcon: Icon(Icons.confirmation_number_outlined),
        isDense: true,
      ),
    );
    final payButton = FilledButton.icon(
      style: FilledButton.styleFrom(
        backgroundColor: AppPalette.red,
        foregroundColor: AppPalette.white,
        minimumSize: const Size(118, 48),
      ),
      onPressed: onCheckout,
      icon: const Icon(Icons.receipt_long_outlined),
      label: const Text('Bayar'),
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < 360) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [promoField, const SizedBox(height: 8), payButton],
          );
        }

        return Row(
          children: [
            Expanded(child: promoField),
            const SizedBox(width: 8),
            payButton,
          ],
        );
      },
    );
  }
}

class _PaymentSheetContent extends StatelessWidget {
  const _PaymentSheetContent({
    required this.total,
    required this.donationController,
    required this.roundingTotal,
    required this.paidTotal,
    required this.changeTotal,
    required this.paymentMethods,
    required this.paymentAmountControllers,
    required this.onPaymentMethodChanged,
    required this.onPaymentAmountChanged,
    required this.onDonationChanged,
    required this.onAddPayment,
    required this.onRemovePayment,
    required this.onCancel,
    required this.onSubmit,
  });

  final double total;
  final TextEditingController donationController;
  final double roundingTotal;
  final double paidTotal;
  final double changeTotal;
  final List<String> paymentMethods;
  final List<TextEditingController> paymentAmountControllers;
  final void Function(int index, String method) onPaymentMethodChanged;
  final VoidCallback onPaymentAmountChanged;
  final VoidCallback onDonationChanged;
  final VoidCallback onAddPayment;
  final ValueChanged<int> onRemovePayment;
  final VoidCallback onCancel;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final canPay = paymentMethods.isNotEmpty && paidTotal + 0.000001 >= total;
    return ConstrainedBox(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.82,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Pembayaran',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
                ),
              ),
              IconButton(
                tooltip: 'Tutup',
                onPressed: onCancel,
                icon: const Icon(Icons.close),
              ),
            ],
          ),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              border: Border.all(color: AppPalette.line),
              borderRadius: BorderRadius.circular(8),
              color: AppPalette.aqua.withValues(alpha: 0.2),
            ),
            child: Row(
              children: [
                const Expanded(
                  child: Text(
                    'Total bayar',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
                Text(
                  _money(total),
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    color: AppPalette.navy,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: donationController,
            keyboardType: TextInputType.number,
            inputFormatters: const [
              IndonesianNumberInputFormatter(decimal: false),
            ],
            onChanged: (_) => onDonationChanged(),
            decoration: const InputDecoration(
              labelText: 'Donasi',
              hintText: '0',
              prefixIcon: Icon(Icons.volunteer_activism_outlined),
            ),
          ),
          if (roundingTotal > 0) ...[
            const SizedBox(height: 10),
            _TotalRow(label: 'Pembulatan', value: _money(roundingTotal)),
          ],
          const SizedBox(height: 12),
          Flexible(
            child: ListView.separated(
              shrinkWrap: true,
              itemCount: paymentMethods.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                return Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        key: ValueKey(
                          'payment-sheet-method-$index-${paymentMethods[index]}',
                        ),
                        isExpanded: true,
                        initialValue: paymentMethods[index],
                        decoration: const InputDecoration(
                          labelText: 'Metode',
                          prefixIcon: Icon(Icons.payments_outlined),
                        ),
                        items: paymentLabels.entries
                            .map(
                              (entry) => DropdownMenuItem(
                                value: entry.key,
                                child: Text(entry.value),
                              ),
                            )
                            .toList(),
                        onChanged: (value) {
                          if (value != null) {
                            onPaymentMethodChanged(index, value);
                          }
                        },
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: paymentAmountControllers[index],
                        keyboardType: TextInputType.number,
                        inputFormatters: const [
                          IndonesianNumberInputFormatter(decimal: false),
                        ],
                        onChanged: (_) => onPaymentAmountChanged(),
                        decoration: InputDecoration(
                          labelText: paymentMethods[index] == 'cash'
                              ? 'Uang diterima'
                              : 'Nominal',
                          hintText: index == 0 ? _money(total) : null,
                          prefixIcon: const Icon(Icons.attach_money),
                        ),
                      ),
                    ),
                    IconButton.outlined(
                      tooltip: 'Hapus pembayaran',
                      onPressed: () => onRemovePayment(index),
                      icon: const Icon(Icons.delete_outline),
                    ),
                  ],
                );
              },
            ),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: onAddPayment,
            icon: const Icon(Icons.add),
            label: const Text('Tambah split payment'),
          ),
          const SizedBox(height: 12),
          _TotalRow(label: 'Dibayar', value: _money(paidTotal)),
          _TotalRow(label: 'Kembali', value: _money(changeTotal)),
          const SizedBox(height: 12),
          FilledButton.icon(
            style: FilledButton.styleFrom(
              backgroundColor: AppPalette.red,
              foregroundColor: AppPalette.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            onPressed: canPay ? onSubmit : null,
            icon: const Icon(Icons.receipt_long_outlined),
            label: Text('Simpan transaksi  ${_money(total)}'),
          ),
        ],
      ),
    );
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
    final unitControl = line.item.unitChoices.length <= 1
        ? _CartMetaChip(icon: Icons.straighten_outlined, text: line.unitLabel)
        : SizedBox(
            width: 112,
            child: DropdownButtonFormField<String>(
              isExpanded: true,
              initialValue: line.unitId,
              decoration: const InputDecoration(isDense: true),
              items: line.item.unitChoices
                  .map(
                    (unit) => DropdownMenuItem(
                      value: unit.id,
                      child: Text(
                        unit.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
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
          );

    return Container(
      padding: const EdgeInsets.fromLTRB(10, 9, 8, 9),
      decoration: BoxDecoration(
        color: AppPalette.white,
        border: Border.all(color: AppPalette.line),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  line.item.skuName,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppPalette.navy,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                _money(line.lineTotal),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.end,
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
              SizedBox(
                width: 34,
                height: 30,
                child: IconButton(
                  tooltip: 'Hapus',
                  style: IconButton.styleFrom(padding: EdgeInsets.zero),
                  onPressed: onRemove,
                  icon: const Icon(Icons.delete_outline, size: 19),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              _CartMetaChip(
                icon: Icons.sell_outlined,
                text: '${_money(line.unitPrice)} / ${line.unitLabel}',
              ),
              unitControl,
              _QuantityStepper(
                quantity: line.quantity,
                onMinus: onMinus,
                onEdit: onEdit,
                onPlus: onPlus,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CartMetaChip extends StatelessWidget {
  const _CartMetaChip({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: 36, maxWidth: 170),
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 7),
      decoration: BoxDecoration(
        color: AppPalette.ivory,
        border: Border.all(color: AppPalette.line),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: AppPalette.blue),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              text,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}

class _QuantityStepper extends StatelessWidget {
  const _QuantityStepper({
    required this.quantity,
    required this.onMinus,
    required this.onEdit,
    required this.onPlus,
  });

  final double quantity;
  final VoidCallback onMinus;
  final VoidCallback onEdit;
  final VoidCallback onPlus;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 36,
      decoration: BoxDecoration(
        border: Border.all(color: AppPalette.line),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _StepButton(
            tooltip: 'Kurangi',
            icon: Icons.remove,
            onPressed: onMinus,
          ),
          TextButton(
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 10),
              minimumSize: const Size(44, 36),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            onPressed: onEdit,
            child: Text(
              _qty(quantity),
              style: const TextStyle(fontWeight: FontWeight.w900),
            ),
          ),
          _StepButton(tooltip: 'Tambah', icon: Icons.add, onPressed: onPlus),
        ],
      ),
    );
  }
}

class _StepButton extends StatelessWidget {
  const _StepButton({
    required this.tooltip,
    required this.icon,
    required this.onPressed,
  });

  final String tooltip;
  final IconData icon;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox.square(
      dimension: 34,
      child: IconButton(
        tooltip: tooltip,
        style: IconButton.styleFrom(padding: EdgeInsets.zero),
        onPressed: onPressed,
        icon: Icon(icon, size: 18),
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
    return Padding(
      padding: const EdgeInsets.fromLTRB(10, 0, 10, 8),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: AppPalette.amber.withValues(alpha: 0.12),
          border: Border.all(color: AppPalette.amber.withValues(alpha: 0.28)),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: [
            const Icon(Icons.info_outline, color: AppPalette.amber, size: 20),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                text,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
      ),
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
            color: AppPalette.navy,
            borderRadius: BorderRadius.circular(8),
            elevation: 10,
            child: InkWell(
              onTap: onPressed,
              borderRadius: BorderRadius.circular(8),
              child: Container(
                width: double.infinity,
                height: 62,
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
        AppSection(
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
        AppSection(
          title: 'List Transaksi',
          subtitle: 'Filter, urutkan, dan cek detail struk',
          icon: Icons.receipt_long_outlined,
          headerColor: AppPalette.navy,
          isLoading: widget.isLoading,
          loadingText: 'Memuat list transaksi...',
          trailing: SectionBadge(
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
    return AppSection(
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

String _money(num value) => 'Rp ${_moneyPlain(value)}';

String _moneyPlain(num value) {
  return _formatIndonesianNumber(value, decimalDigits: 0);
}

double _roundToCashHundred(num value) {
  if (value <= 0) return 0;
  return (value / 100).ceil() * 100;
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

  String center(String value) {
    final safe = clip(value);
    final leftPad = max(0, ((width - safe.length) / 2).floor());
    return '${' ' * leftPad}$safe';
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
    if (block == 'logo') return;
    if (block == 'outlet') lines.add(center(receipt.outletName));
    if (block == 'address') {
      lines.add(center(_dateTimeLabel(receipt.createdAt)));
    }
    if (block == 'cashier') lines.add(center('Kasir: ${receipt.cashierName}'));
    if (block == 'receiptNumber') {
      lines.add(center('No: ${receipt.receiptNumber}'));
    }
    if (block == 'items') {
      lines.add(separator);
      for (final item in receipt.lines) {
        lines.add(clip(item.name));
        lines.add(
          row(
            '${_qty(item.quantity)} ${item.unitLabel} x ${_money(item.unitPrice)}',
            _money(item.lineTotal),
          ),
        );
        if (item.discountTotal > 0) {
          lines.add(row('Diskon item', _money(item.discountTotal)));
        }
      }
    }
    if (block == 'totals') {
      lines.add(separator);
      if (receipt.subtotal > 0) {
        lines.add(row('Subtotal', _money(receipt.subtotal)));
      }
      if (receipt.discount > 0) {
        lines.add(row('Diskon', _money(receipt.discount)));
      }
      if (receipt.tax > 0) {
        lines.add(row('Pajak', _money(receipt.tax)));
      }
      if (receipt.serviceCharge > 0) {
        lines.add(row('Service', _money(receipt.serviceCharge)));
      }
      if (receipt.donation > 0) {
        lines.add(row('Donasi', _money(receipt.donation)));
      }
      if (receipt.rounding > 0) {
        lines.add(row('Pembulatan', _money(receipt.rounding)));
      }
      lines.add(row('TOTAL', _money(receipt.grandTotal)));
    }
    if (block == 'payment') {
      final cashAppliedTotal = receipt.payments
          .where((payment) => payment.method == 'cash')
          .fold<double>(0, (sum, item) => sum + item.amount);
      final cashDisplayTotal = max(receipt.cashTenderedTotal, cashAppliedTotal);
      for (final payment in receipt.payments.where(
        (payment) => payment.amount > 0 && payment.method != 'cash',
      )) {
        lines.add(row(payment.label, _money(payment.amount)));
      }
      if (cashDisplayTotal > 0) {
        lines.add(
          row(
            cashDisplayTotal > cashAppliedTotal ? 'Tunai diterima' : 'Tunai',
            _money(cashDisplayTotal),
          ),
        );
      }
      if (receipt.receivableAmount > 0) {
        lines.add(row('Piutang', _money(receipt.receivableAmount)));
      }
      final fallbackPaid = receipt.payments.fold<double>(
        0,
        (sum, item) => sum + item.amount,
      );
      final change = receipt.changeTotal > 0
          ? receipt.changeTotal
          : max(0, fallbackPaid - receipt.grandTotal);
      if (change > 0) {
        lines.add(row('Kembali', _money(change)));
      }
    }
    if (block == 'note') {
      lines.add(separator);
      lines.add(center(layout.footerNote));
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
