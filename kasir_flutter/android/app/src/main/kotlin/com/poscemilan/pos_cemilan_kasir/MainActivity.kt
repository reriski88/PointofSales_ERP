package com.poscemilan.pos_cemilan_kasir

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.content.pm.PackageManager
import android.os.Build
import android.util.Base64
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.embedding.android.FlutterActivity
import io.flutter.plugin.common.MethodChannel
import java.io.IOException
import java.nio.charset.Charset
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
                    val logoRasterBase64 = call.argument<String>("logoRasterBase64").orEmpty()
                    try {
                        printBluetooth(target, text, logoRasterBase64)
                        result.success(true)
                    } catch (error: Exception) {
                        result.error("BLUETOOTH_PRINT_FAILED", error.message, null)
                    }
                }
                "connectBluetooth" -> {
                    val target = call.argument<String>("target").orEmpty()
                    try {
                        connectBluetooth(target)
                        result.success(true)
                    } catch (error: Exception) {
                        result.error("BLUETOOTH_CONNECT_FAILED", error.message, null)
                    }
                }
                else -> result.notImplemented()
            }
        }
    }

    private fun listBluetoothDevices(): List<Map<String, String>> {
        if (!hasBluetoothPermission()) {
            requestBluetoothPermissions()
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
        return missingBluetoothPermissions().isEmpty()
    }

    private fun missingBluetoothPermissions(): Array<String> {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return emptyArray()
        return arrayOf(Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN)
            .filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
            .toTypedArray()
    }

    private fun requestBluetoothPermissions() {
        val missing = missingBluetoothPermissions()
        if (missing.isNotEmpty()) requestPermissions(missing, 2101)
    }

    private fun printBluetooth(target: String, text: String, logoRasterBase64: String) {
        val socket = openBluetoothPrinterSocket(target)
        try {
            socket.outputStream.use { output ->
                if (logoRasterBase64.isNotBlank()) {
                    output.write(Base64.decode(logoRasterBase64, Base64.DEFAULT))
                    output.write(byteArrayOf(0x0D, 0x0A))
                }
                output.write(buildEscPosText(text))
                output.flush()
                Thread.sleep(500)
            }
        } finally {
            closeSocketQuietly(socket)
        }
    }

    private fun connectBluetooth(target: String) {
        val socket = openBluetoothPrinterSocket(target)
        closeSocketQuietly(socket)
    }

    private fun openBluetoothPrinterSocket(target: String): BluetoothSocket {
        if (!hasBluetoothPermission()) {
            requestBluetoothPermissions()
            throw IllegalStateException("Izin Bluetooth belum diberikan. Izinkan Bluetooth lalu ulangi print.")
        }
        val adapter = BluetoothAdapter.getDefaultAdapter()
            ?: throw IllegalStateException("Bluetooth tidak tersedia di perangkat ini.")
        if (!adapter.isEnabled) {
            throw IllegalStateException("Bluetooth belum aktif.")
        }
        val device = findBondedDevice(adapter, target)
            ?: throw IllegalStateException("Printer Bluetooth tidak ditemukan. Pair printer di Android dan isi nama/MAC yang sesuai.")
        cancelDiscoveryIfAllowed(adapter)
        return connectPrinterSocket(device)
    }

    private fun closeSocketQuietly(socket: BluetoothSocket) {
        try {
            socket.close()
        } catch (_: IOException) {
        }
    }

    private fun cancelDiscoveryIfAllowed(adapter: BluetoothAdapter) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
            checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED
        ) {
            adapter.cancelDiscovery()
        }
    }

    private fun connectPrinterSocket(device: BluetoothDevice): BluetoothSocket {
        val errors = mutableListOf<String>()
        val factories = listOf<(BluetoothDevice) -> BluetoothSocket>(
            { it.createInsecureRfcommSocketToServiceRecord(sppUuid) },
            { it.javaClass.getMethod("createRfcommSocket", Int::class.javaPrimitiveType).invoke(it, 1) as BluetoothSocket },
            { it.createRfcommSocketToServiceRecord(sppUuid) },
        )

        for (factory in factories) {
            val socket = try {
                factory(device)
            } catch (error: Exception) {
                errors.add(error.message ?: error.javaClass.simpleName)
                continue
            }
            try {
                socket.connect()
                return socket
            } catch (error: Exception) {
                errors.add(error.message ?: error.javaClass.simpleName)
                try {
                    socket.close()
                } catch (_: IOException) {
                }
            }
        }

        throw IllegalStateException("Gagal terhubung ke printer Bluetooth. Pastikan printer menyala, sudah dipairing, dan tidak sedang dipakai aplikasi lain. ${errors.joinToString(" | ")}")
    }

    private fun buildEscPosText(text: String): ByteArray {
        val normalized = text
            .replace("\r\n", "\n")
            .replace("\r", "\n")
            .replace("\n", "\r\n")
        val body = normalized.toByteArray(Charset.forName("windows-1252"))
        return byteArrayOf(0x1B, 0x40, 0x1B, 0x74, 0x10) +
            body +
            byteArrayOf(0x0D, 0x0A, 0x0D, 0x0A, 0x0D, 0x0A, 0x1D, 0x56, 0x42, 0x00)
    }

    private fun findBondedDevice(adapter: BluetoothAdapter, target: String): BluetoothDevice? {
        val normalized = target.trim().lowercase()
        val compactTarget = normalized.replace(Regex("[^a-z0-9]"), "")
        return adapter.bondedDevices.firstOrNull { device ->
            val name = device.name.orEmpty().lowercase()
            val compactName = name.replace(Regex("[^a-z0-9]"), "")
            device.address.lowercase() == normalized ||
                name == normalized ||
                (compactTarget.isNotEmpty() && compactName.contains(compactTarget)) ||
                (compactName.isNotEmpty() && compactTarget.contains(compactName)) ||
                looksLikeSameThermalModel(compactName, compactTarget)
        }
    }

    private fun looksLikeSameThermalModel(deviceName: String, target: String): Boolean {
        if (deviceName.isEmpty() || target.isEmpty()) return false
        if (!deviceName.contains("rpp") || !target.contains("rpp")) return false
        val deviceNumbers = Regex("\\d+").findAll(deviceName).map { it.value }.toSet()
        val targetNumbers = Regex("\\d+").findAll(target).map { it.value }.toSet()
        return deviceNumbers.isNotEmpty() && deviceNumbers.intersect(targetNumbers).isNotEmpty()
    }
}
