import 'package:flutter/material.dart';
import 'package:pos_cemilan_kasir/core/theme/app_palette.dart';

class LoginView extends StatefulWidget {
  const LoginView({
    super.key,
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
  State<LoginView> createState() => _LoginViewState();
}

class _LoginViewState extends State<LoginView> {
  var _showAdvanced = false;

  @override
  Widget build(BuildContext context) {
    final compact = MediaQuery.of(context).size.width < 520;
    return Scaffold(
      backgroundColor: AppPalette.ivory,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(compact ? 16 : 28, compact ? 18 : 34, compact ? 16 : 28, compact ? 18 : 34),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    padding: EdgeInsets.all(compact ? 16 : 20),
                    decoration: BoxDecoration(
                      color: AppPalette.navy,
                      borderRadius: BorderRadius.circular(8),
                      boxShadow: [BoxShadow(color: AppPalette.navy.withValues(alpha: 0.18), blurRadius: 22, offset: const Offset(0, 10))],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 52, height: 52,
                              decoration: BoxDecoration(color: AppPalette.aqua, borderRadius: BorderRadius.circular(8)),
                              child: const Icon(Icons.point_of_sale, color: AppPalette.blue, size: 30),
                            ),
                            const SizedBox(width: 12),
                            const Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Smart POS ERP Kasir', maxLines: 1, overflow: TextOverflow.ellipsis,
                                    style: TextStyle(color: AppPalette.white, fontSize: 23, fontWeight: FontWeight.w900)),
                                  Text('Terminal kasir mobile', maxLines: 1, overflow: TextOverflow.ellipsis,
                                    style: TextStyle(color: AppPalette.aqua, fontWeight: FontWeight.w700)),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 18),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppPalette.white.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: AppPalette.white.withValues(alpha: 0.12)),
                          ),
                          child: const Row(
                            children: [
                              Icon(Icons.verified_user_outlined, color: AppPalette.aqua),
                              SizedBox(width: 10),
                              Expanded(child: Text('Login kasir untuk transaksi outlet, laporan, shift, dan printer.',
                                style: TextStyle(color: AppPalette.white, fontWeight: FontWeight.w700))),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  Container(
                    padding: EdgeInsets.all(compact ? 16 : 20),
                    decoration: BoxDecoration(
                      color: AppPalette.white,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppPalette.line),
                      boxShadow: [BoxShadow(color: AppPalette.navy.withValues(alpha: 0.06), blurRadius: 18, offset: const Offset(0, 8))],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text('Masuk Kasir', style: TextStyle(color: AppPalette.navy, fontSize: 20, fontWeight: FontWeight.w900)),
                        const SizedBox(height: 4),
                        const Text('Gunakan akun yang sudah punya akses outlet.',
                          style: TextStyle(color: AppPalette.slate, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 16),
                        // -- Pengaturan Lanjutan (collapsible) --
                        InkWell(
                          onTap: () => setState(() => _showAdvanced = !_showAdvanced),
                          borderRadius: BorderRadius.circular(8),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 6),
                            child: Row(
                              children: [
                                Icon(Icons.settings_outlined, size: 16, color: AppPalette.slate.withValues(alpha: 0.6)),
                                const SizedBox(width: 6),
                                Text('Pengaturan Server', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppPalette.slate.withValues(alpha: 0.6))),
                                const Spacer(),
                                Icon(_showAdvanced ? Icons.expand_less : Icons.expand_more, size: 18, color: AppPalette.slate.withValues(alpha: 0.5)),
                              ],
                            ),
                          ),
                        ),
                        if (_showAdvanced) ...[
                          const SizedBox(height: 8),
                          TextField(
                            controller: widget.baseUrlController,
                            decoration: const InputDecoration(
                              labelText: 'Alamat Server',
                              hintText: 'http://192.168.1.100:3001',
                              prefixIcon: Icon(Icons.dns_outlined),
                              helperText: 'Biarkan default, kecuali diarahkan IT Support.',
                              helperMaxLines: 2,
                            ),
                          ),
                        ],
                        const SizedBox(height: 12),
                        TextField(
                          controller: widget.emailController,
                          keyboardType: TextInputType.emailAddress,
                          decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.mail_outline)),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: widget.passwordController,
                          obscureText: true,
                          decoration: const InputDecoration(labelText: 'Password', prefixIcon: Icon(Icons.lock_outline)),
                          onSubmitted: (_) => widget.onSubmit(),
                        ),
                        if (widget.message.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          Container(
                            padding: const EdgeInsets.all(11),
                            decoration: BoxDecoration(
                              color: AppPalette.red.withValues(alpha: 0.08),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: AppPalette.red.withValues(alpha: 0.24)),
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Icon(Icons.error_outline, color: AppPalette.red, size: 19),
                                const SizedBox(width: 8),
                                Expanded(child: Text(widget.message,
                                  style: TextStyle(color: Theme.of(context).colorScheme.error, fontWeight: FontWeight.w700))),
                              ],
                            ),
                          ),
                        ],
                        const SizedBox(height: 18),
                        FilledButton.icon(
                          style: FilledButton.styleFrom(
                            backgroundColor: AppPalette.blue,
                            foregroundColor: AppPalette.white,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          onPressed: widget.isBusy ? null : widget.onSubmit,
                          icon: widget.isBusy
                              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: AppPalette.white))
                              : const Icon(Icons.login),
                          label: Text(widget.isBusy ? 'Memproses' : 'Masuk'),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
