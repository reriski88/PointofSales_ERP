import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { ApiError, handleRouteError, ok, parseJson } from "@/lib/http";
import { requireActor, requireRole } from "@/lib/rbac";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

const printReceiptSchema = z.object({
  printerName: z.string().trim().min(1).max(120),
  text: z.string().min(1).max(20_000),
  logoRasterBase64: z.string().max(250_000).optional(),
});

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    requireRole(actor, ["owner", "admin_outlet", "cashier", "auditor"]);
    const body = await parseJson(request, printReceiptSchema);
    await printTextToWindowsPrinter(body.printerName, body.text, body.logoRasterBase64);
    return ok({ printed: true, printerName: body.printerName });
  } catch (error) {
    return handleRouteError(error);
  }
}

async function printTextToWindowsPrinter(printerName: string, text: string, logoRasterBase64?: string) {
  if (process.platform !== "win32") {
    throw new ApiError("BAD_REQUEST", "Direct thermal print hanya tersedia di Windows.", 400);
  }

  const filePath = join(tmpdir(), `pos-receipt-${randomUUID()}.txt`);
  const logoPath = logoRasterBase64 ? join(tmpdir(), `pos-receipt-logo-${randomUUID()}.bin`) : "";
  await writeFile(filePath, text, "utf8");
  if (logoRasterBase64 && logoPath) {
    await writeFile(logoPath, Buffer.from(logoRasterBase64, "base64"));
  }

  try {
    const script = `
$ErrorActionPreference = 'Stop'
$printerName = $env:POS_PRINTER_NAME
$filePath = $env:POS_RECEIPT_FILE
$logoPath = $env:POS_RECEIPT_LOGO_FILE
$printer = Get-Printer -Name $printerName -ErrorAction SilentlyContinue
if (-not $printer) { throw "Printer '$printerName' tidak ditemukan atau belum terpasang." }
$rawPrinterSource = @"
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }

  [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

  [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool ClosePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

  [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);

  public static bool SendBytesToPrinter(string printerName, byte[] bytes) {
    IntPtr printerHandle;
    if (!OpenPrinter(printerName.Normalize(), out printerHandle, IntPtr.Zero)) return false;
    try {
      DOCINFOA docInfo = new DOCINFOA();
      docInfo.pDocName = "POS ERP Receipt";
      docInfo.pDataType = "RAW";
      int written;
      if (!StartDocPrinter(printerHandle, 1, docInfo)) return false;
      try {
        if (!StartPagePrinter(printerHandle)) return false;
        try {
          return WritePrinter(printerHandle, bytes, bytes.Length, out written) && written == bytes.Length;
        } finally {
          EndPagePrinter(printerHandle);
        }
      } finally {
        EndDocPrinter(printerHandle);
      }
    } finally {
      ClosePrinter(printerHandle);
    }
  }
}
"@
Add-Type -TypeDefinition $rawPrinterSource
$text = Get-Content -LiteralPath $filePath -Raw
$normalizedText = $text -replace "(\\r\\n|\\n|\\r)", ([string][char]13 + [string][char]10)
$textBytes = [System.Text.Encoding]::ASCII.GetBytes($normalizedText)
$logoBytes = if ($logoPath -and (Test-Path -LiteralPath $logoPath)) { [System.IO.File]::ReadAllBytes($logoPath) } else { [byte[]]@() }
$bytes = [byte[]](27, 64) + $logoBytes + $textBytes + [byte[]](13, 10, 13, 10, 27, 100, 4, 12)
$printed = [RawPrinterHelper]::SendBytesToPrinter($printerName, $bytes)
if (-not $printed) {
  $code = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
  throw "Windows spooler gagal mengirim RAW job ke '$printerName'. Win32Error=$code"
}
`;

    await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      script,
    ], {
      env: {
        ...process.env,
        POS_PRINTER_NAME: printerName,
        POS_RECEIPT_FILE: filePath,
        POS_RECEIPT_LOGO_FILE: logoPath,
      },
      windowsHide: true,
      timeout: 15_000,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Print struk gagal.";
    throw new ApiError("INTERNAL_ERROR", `Print ke printer ${printerName} gagal. ${message}`, 500);
  } finally {
    await rm(filePath, { force: true });
    if (logoPath) {
      await rm(logoPath, { force: true });
    }
  }
}
