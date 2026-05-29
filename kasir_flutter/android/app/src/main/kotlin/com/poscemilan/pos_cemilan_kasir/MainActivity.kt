package com.poscemilan.pos_cemilan_kasir

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.content.pm.PackageManager
import android.os.Build
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.embedding.android.FlutterActivity
import io.flutter.plugin.common.MethodChannel
import java.util.UUID

class MainActivity : FlutterActivity() {
    private val channelName = "pos_cemilan/printer"
    private val sppUuid: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName).setMethodCallHandler { call, result ->
            when (call.method) {
                "listBluetoothDevices" -> {
                    try {
                        result.success(listBluetoothDevices())
                    } catch (error: Exception) {
                        result.error("BLUETOOTH_LIST_FAILED", error.message, null)
                    }
                }
                "printBluetooth" -> {
                    val target = call.argument<String>("target").orEmpty()
                    val text = call.argument<String>("text").orEmpty()
                    try {
                        printBluetooth(target, text)
                        result.success(true)
                    } catch (error: Exception) {
                        result.error("BLUETOOTH_PRINT_FAILED", error.message, null)
                    }
                }
                else -> result.notImplemented()
            }
        }
    }

    private fun listBluetoothDevices(): List<Map<String, String>> {
        if (!hasBluetoothPermission()) {
            requestPermissions(arrayOf(Manifest.permission.BLUETOOTH_CONNECT), 2101)
            throw IllegalStateException("Izin Bluetooth belum diberikan. Izinkan Bluetooth lalu buka daftar printer lagi.")
        }
        val adapter = BluetoothAdapter.getDefaultAdapter()
            ?: throw IllegalStateException("Bluetooth tidak tersedia di perangkat ini.")
        if (!adapter.isEnabled) {
            throw IllegalStateException("Bluetooth belum aktif.")
        }
        return adapter.bondedDevices
            .sortedWith(compareBy<BluetoothDevice> { it.name.orEmpty().lowercase() }.thenBy { it.address })
            .map { device ->
                mapOf(
                    "name" to device.name.orEmpty(),
                    "address" to device.address,
                    "type" to when (device.type) {
                        BluetoothDevice.DEVICE_TYPE_CLASSIC -> "classic"
                        BluetoothDevice.DEVICE_TYPE_LE -> "le"
                        BluetoothDevice.DEVICE_TYPE_DUAL -> "dual"
                        else -> "unknown"
                    },
                )
            }
    }

    private fun hasBluetoothPermission(): Boolean {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
            checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
    }

    private fun printBluetooth(target: String, text: String) {
        if (!hasBluetoothPermission()) {
            requestPermissions(arrayOf(Manifest.permission.BLUETOOTH_CONNECT), 2101)
            throw IllegalStateException("Izin Bluetooth belum diberikan. Izinkan Bluetooth lalu ulangi print.")
        }
        val adapter = BluetoothAdapter.getDefaultAdapter()
            ?: throw IllegalStateException("Bluetooth tidak tersedia di perangkat ini.")
        if (!adapter.isEnabled) {
            throw IllegalStateException("Bluetooth belum aktif.")
        }
        val device = findBondedDevice(adapter, target)
            ?: throw IllegalStateException("Printer Bluetooth tidak ditemukan. Pair printer di Android dan isi nama/MAC yang sesuai.")
        val socket = device.createRfcommSocketToServiceRecord(sppUuid)
        adapter.cancelDiscovery()
        socket.connect()
        socket.outputStream.use { output ->
            output.write(byteArrayOf(0x1B, 0x40))
            output.write(text.toByteArray(Charsets.UTF_8))
            output.write(byteArrayOf(0x0A, 0x0A, 0x0A, 0x1D, 0x56, 0x00))
            output.flush()
        }
        socket.close()
    }

    private fun findBondedDevice(adapter: BluetoothAdapter, target: String): BluetoothDevice? {
        val normalized = target.trim().lowercase()
        return adapter.bondedDevices.firstOrNull { device ->
            device.address.lowercase() == normalized || device.name.orEmpty().lowercase() == normalized
        }
    }
}
