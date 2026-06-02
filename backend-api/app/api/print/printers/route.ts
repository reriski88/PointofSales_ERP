import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ApiError, handleRouteError, ok } from "@/lib/http";
import { actorHasPermission, requireActor } from "@/lib/rbac";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

type WindowsPrinter = {
  name?: string;
  status?: string;
  portName?: string;
  driverName?: string;
};

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const canViewReceipt = await actorHasPermission(actor, "receipt", "view");
    const canViewCashier = await actorHasPermission(actor, "cashier", "view");
    if (!canViewReceipt && !canViewCashier) {
      throw new ApiError("FORBIDDEN", "Role permission is not allowed for this operation", 403);
    }
    if (process.platform !== "win32") {
      return ok([]);
    }

    const { stdout } = await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        "Get-Printer | Select-Object @{Name='name';Expression={$_.Name}}, @{Name='status';Expression={$_.PrinterStatus.ToString()}}, @{Name='portName';Expression={$_.PortName}}, @{Name='driverName';Expression={$_.DriverName}} | ConvertTo-Json -Depth 2",
      ],
      { windowsHide: true, timeout: 10_000 },
    );
    const parsed = JSON.parse(stdout || "[]") as WindowsPrinter | WindowsPrinter[];
    const rows = (Array.isArray(parsed) ? parsed : [parsed])
      .filter((item) => item?.name)
      .map((item) => ({
        name: String(item.name),
        status: String(item.status ?? ""),
        portName: String(item.portName ?? ""),
        driverName: String(item.driverName ?? ""),
      }));

    return ok(rows);
  } catch (error) {
    return handleRouteError(error);
  }
}
