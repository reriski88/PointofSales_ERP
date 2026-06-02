import 'package:flutter/material.dart';
import 'package:pos_cemilan_kasir/core/theme/app_palette.dart';

class PrinterDeviceViewModel {
  const PrinterDeviceViewModel({required this.name, required this.address});

  final String name;
  final String address;

  String get displayName => name.trim().isEmpty ? 'Bluetooth Printer' : name;
}

class PrinterSettingsCard extends StatelessWidget {
  const PrinterSettingsCard({
    super.key,
    required this.enabled,
    required this.connection,
    required this.bluetoothController,
    required this.bluetoothDevices,
    required this.isLoadingBluetoothDevices,
    required this.isBluetoothConnected,
    required this.isConnectingBluetoothDevice,
    required this.isPrintingReceipt,
    required this.connectedBluetoothTarget,
    required this.paperWidth,
    required this.autoPrintFromDashboard,
    required this.onEnabledChanged,
    required this.onRefreshBluetoothDevices,
    required this.onConnectBluetoothDevice,
    required this.onDisconnectBluetoothDevice,
    required this.onSave,
    required this.onTestPrint,
  });

  final bool enabled;
  final String connection;
  final TextEditingController bluetoothController;
  final List<PrinterDeviceViewModel> bluetoothDevices;
  final bool isLoadingBluetoothDevices;
  final bool isBluetoothConnected;
  final bool isConnectingBluetoothDevice;
  final bool isPrintingReceipt;
  final String? connectedBluetoothTarget;
  final String paperWidth;
  final bool autoPrintFromDashboard;
  final ValueChanged<bool> onEnabledChanged;
  final VoidCallback onRefreshBluetoothDevices;
  final ValueChanged<PrinterDeviceViewModel> onConnectBluetoothDevice;
  final VoidCallback onDisconnectBluetoothDevice;
  final VoidCallback onSave;
  final VoidCallback onTestPrint;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      child: ExpansionTile(
        initiallyExpanded: false,
        leading: const Icon(Icons.print_outlined, color: AppPalette.navy),
        title: const Text(
          'Printer Thermal',
          style: TextStyle(fontWeight: FontWeight.w900),
        ),
        subtitle: const Text('Khusus printer Bluetooth'),
        childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
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
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.bluetooth),
            title: const Text('Koneksi Bluetooth'),
            subtitle: Text(
              connection == 'bluetooth'
                  ? 'Printer kasir hanya menggunakan Bluetooth.'
                  : 'Mode printer otomatis dikembalikan ke Bluetooth.',
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: bluetoothController,
            readOnly: true,
            decoration: const InputDecoration(
              labelText: 'Printer dipilih',
              prefixIcon: Icon(Icons.print_outlined),
            ),
          ),
          const SizedBox(height: 8),
          _BluetoothStatusBox(isConnected: isBluetoothConnected),
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
            ...bluetoothDevices.map(_buildDeviceTile),
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
                onPressed: enabled && !isPrintingReceipt && isBluetoothConnected
                    ? onTestPrint
                    : null,
                icon: isPrintingReceipt
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.receipt_long_outlined),
                label: Text(isPrintingReceipt ? 'Mengirim...' : 'Test Print'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDeviceTile(PrinterDeviceViewModel device) {
    final selected =
        bluetoothController.text.trim() == device.address ||
        connectedBluetoothTarget == device.address;
    final connected = selected && isBluetoothConnected;
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Icon(
          connected ? Icons.bluetooth_connected : Icons.print_outlined,
          color: connected ? AppPalette.blue : null,
        ),
        title: Text(device.displayName),
        subtitle: Text(
          connected ? '${device.address} - konek' : device.address,
        ),
        trailing: connected
            ? FilledButton.tonalIcon(
                onPressed: isConnectingBluetoothDevice
                    ? null
                    : onDisconnectBluetoothDevice,
                icon: const Icon(Icons.link_off),
                label: const Text('Diskonek'),
              )
            : FilledButton.icon(
                onPressed: isConnectingBluetoothDevice
                    ? null
                    : () => onConnectBluetoothDevice(device),
                icon: isConnectingBluetoothDevice && selected
                    ? const SizedBox.square(
                        dimension: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.bluetooth_connected),
                label: Text(
                  isConnectingBluetoothDevice && selected
                      ? 'Konek...'
                      : 'Konek',
                ),
              ),
      ),
    );
  }
}

class _BluetoothStatusBox extends StatelessWidget {
  const _BluetoothStatusBox({required this.isConnected});

  final bool isConnected;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: isConnected
            ? AppPalette.aqua.withValues(alpha: 0.25)
            : AppPalette.ivory,
        border: Border.all(
          color: isConnected ? AppPalette.blue : AppPalette.aqua,
        ),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(
            isConnected
                ? Icons.bluetooth_connected
                : Icons.bluetooth_disabled_outlined,
            color: AppPalette.blue,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              isConnected
                  ? 'Printer sudah konek. Auto print siap dipakai.'
                  : 'Pilih printer dari daftar, lalu tekan Konek.',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}
