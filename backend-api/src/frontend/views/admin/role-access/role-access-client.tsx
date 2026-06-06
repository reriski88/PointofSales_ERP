"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Info, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CollapsibleSection } from "../_components/collapsible-section";
import { useToast } from "../_components/toast-provider";
import { clearAdminDataCache } from "@/frontend/controllers/admin-data-cache";

type ActionKey = "view" | "create" | "edit" | "delete" | "approve" | "export";
type MenuKey =
  | "dashboard"
  | "cashier"
  | "outlets"
  | "users"
  | "roleAccess"
  | "products"
  | "customers"
  | "promotions"
  | "inventory"
  | "stockOpname"
  | "suppliers"
  | "purchases"
  | "reports"
  | "financialReports"
  | "receipt"
  | "profile";
type AppRole = "cashier" | "warehouse" | "auditor" | "admin_outlet" | "owner";
type MenuDef = { key: MenuKey; label: string; description: string; actions: ActionKey[] };
type ActionDef = { key: ActionKey; label: string; description: string };
type RoleAccessMap = Record<AppRole, Record<MenuKey, ActionKey[]>>;
type ApiResponse = {
  data: {
    menus: MenuDef[];
    actions: ActionDef[];
    roleLabels: Record<AppRole, string>;
    roleDescriptions: Record<AppRole, string>;
    permissions: RoleAccessMap;
  };
};

const roleOrder: AppRole[] = [
  "owner",
  "admin_outlet",
  "auditor",
  "warehouse",
  "cashier",
];

export function RoleAccessClient() {
  const { showToast } = useToast();
  const [menus, setMenus] = useState<MenuDef[]>([]);
  const [actions, setActions] = useState<ActionDef[]>([]);
  const [roleLabels, setRoleLabels] = useState<Record<AppRole, string> | null>(
    null,
  );
  const [roleDescriptions, setRoleDescriptions] = useState<Record<AppRole, string> | null>(null);
  const [permissions, setPermissions] = useState<RoleAccessMap | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole>("admin_outlet");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedPermissions = useMemo(
    () => permissions?.[selectedRole],
    [permissions, selectedRole],
  );
  const roleStats = useMemo(() => {
    const total = menus.reduce((sum, menu) => sum + menu.actions.length, 0);
    const active = menus.reduce((sum, menu) => sum + (selectedPermissions?.[menu.key]?.length ?? 0), 0);
    const fullMenus = menus.filter((menu) => menu.actions.length > 0 && menu.actions.every((action) => (selectedPermissions?.[menu.key] ?? []).includes(action))).length;
    return { total, active, fullMenus };
  }, [menus, selectedPermissions]);

  async function loadData() {
    setIsLoading(true);
    setMessage(null);
    const response = await fetch("/api/role-access");
    if (response.status === 401) {
      window.location.href = "/admin/login";
      return;
    }
    if (response.status === 403) {
      setMessage("Hanya owner yang dapat membuka Setting Role Akses.");
      setIsLoading(false);
      return;
    }
    if (!response.ok) {
      setMessage("Gagal memuat setting role akses.");
      setIsLoading(false);
      return;
    }

    const json = (await response.json()) as ApiResponse;
    setMenus(json.data.menus);
    setActions(json.data.actions);
    setRoleLabels(json.data.roleLabels);
    setRoleDescriptions(json.data.roleDescriptions);
    setPermissions(json.data.permissions);
    setIsLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, []);

  async function saveData() {
    if (!permissions) return;
    setIsSaving(true);
    setMessage(null);
    const response = await fetch("/api/role-access", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions }),
    });

    if (!response.ok) {
      setMessage("Setting role akses gagal disimpan. Periksa pilihan akses.");
      showToast({ tone: "error", title: "Setting role akses gagal disimpan" });
      setIsSaving(false);
      return;
    }

    const json = (await response.json()) as ApiResponse;
    clearAdminDataCache(["role-access-me"]);
    window.sessionStorage.removeItem("pos_admin_role_permissions");
    window.sessionStorage.removeItem("pos_admin_visible_menu_keys");
    setPermissions(json.data.permissions);
    setMessage("Setting role akses berhasil disimpan.");
    showToast({ tone: "success", title: "Setting role akses berhasil disimpan" });
    setIsSaving(false);
  }

  function toggleAction(menuKey: MenuKey, action: ActionKey) {
    if (!permissions || selectedRole === "owner" || menuKey === "roleAccess") return;
    setPermissions((current) => {
      if (!current) return current;
      const currentActions = current[selectedRole][menuKey] ?? [];
      const nextActions = currentActions.includes(action)
        ? currentActions.filter((item) => item !== action)
        : [...currentActions, action];
      return {
        ...current,
        [selectedRole]: {
          ...current[selectedRole],
          [menuKey]: nextActions,
        },
      };
    });
  }

  function setMenuActions(menu: MenuDef, checked: boolean) {
    if (!permissions || selectedRole === "owner" || menu.key === "roleAccess") return;
    setPermissions((current) =>
      current
        ? {
            ...current,
            [selectedRole]: {
              ...current[selectedRole],
              [menu.key]: checked ? menu.actions : [],
            },
          }
        : current,
    );
  }

  return (
    <CollapsibleSection
      title="Setting Role Akses"
      description="Atur akses setiap role sesuai fungsi aplikasi POS: kasir, produk, inventory, laporan, laporan keuangan, dan pengaturan."
      showDescription
      isLoading={isLoading}
      loadingText="Memuat setting role akses..."
      actions={
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => void loadData()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            onClick={() => void saveData()}
            disabled={isLoading || isSaving || !permissions}
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Menyimpan" : "Simpan"}
          </Button>
        </div>
      }
    >
      <AlertMessage message={message} />

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <RoleMetric label="Permission aktif" value={`${roleStats.active}/${roleStats.total}`} tone="blue" />
        <RoleMetric label="Menu akses penuh" value={`${roleStats.fullMenus} menu`} tone="emerald" />
        <RoleMetric label="Role dipilih" value={roleLabels?.[selectedRole] ?? selectedRole} tone={selectedRole === "owner" ? "amber" : "violet"} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
        <div className="rounded-lg border bg-muted/25 p-2 shadow-sm">
          {roleOrder.map((role) => (
            <button
              key={role}
              type="button"
              title={roleDescriptions?.[role] ?? role}
              className={`flex h-10 w-full items-center justify-between rounded-md px-3 text-left text-sm font-medium ${
                selectedRole === role
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "hover:bg-background hover:text-foreground"
              }`}
              onClick={() => setSelectedRole(role)}
            >
              {roleLabels?.[role] ?? role}
              {role === "owner" ? <ShieldCheck className="h-4 w-4" /> : <Info className="h-4 w-4 text-muted-foreground" />}
            </button>
          ))}
        </div>

        <div className="thin-x-scroll overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b bg-background text-xs font-semibold text-foreground">
              <tr>
                <th className="w-56 px-3 py-3 text-left font-semibold">Menu</th>
                <th className="w-28 px-3 py-3 text-left font-semibold">Semua</th>
                {actions.map((action) => (
                  <th key={action.key} className="px-3 py-3 text-center font-semibold" title={action.description}>
                    <span className="inline-flex items-center justify-center gap-1">
                      {action.label}
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {menus.map((menu) => {
                const activeActions = selectedPermissions?.[menu.key] ?? [];
                const isLocked =
                  selectedRole === "owner" || menu.key === "roleAccess";
                const isAllChecked =
                  menu.actions.length > 0 &&
                  menu.actions.every((action) => activeActions.includes(action));
                return (
                  <tr key={menu.key} className="border-b transition-colors hover:bg-muted/25 last:border-b-0">
                    <td className="px-3 py-3 font-medium">
                      <span className="inline-flex items-center gap-2" title={menu.description}>
                        {menu.label}
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </span>
                      <p className="mt-1 max-w-xs text-xs font-normal text-muted-foreground">
                        {menu.description}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={isAllChecked}
                        disabled={isLocked}
                        onChange={(event) =>
                          setMenuActions(menu, event.target.checked)
                        }
                        aria-label={`Semua akses ${menu.label}`}
                        title={`Aktifkan/nonaktifkan semua permission yang tersedia untuk menu ${menu.label}.`}
                        className="h-4 w-4 accent-primary"
                      />
                    </td>
                    {actions.map((action) => {
                      const supported = menu.actions.includes(action.key);
                      return (
                        <td key={action.key} className="px-3 py-3 text-center">
                          {supported ? (
                            <input
                              type="checkbox"
                              checked={activeActions.includes(action.key)}
                              disabled={isLocked}
                              onChange={() => toggleAction(menu.key, action.key)}
                              aria-label={`${action.label} ${menu.label}`}
                              title={`${action.label} ${menu.label}: ${action.description}`}
                              className="h-4 w-4 accent-primary"
                            />
                          ) : (
                            <span className="text-muted-foreground" title={`Aksi ${action.label} tidak dipakai pada menu ${menu.label}.`}>-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedRole === "owner" ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Role Owner selalu memiliki seluruh akses dan tidak bisa dikurangi dari
          halaman ini.
        </p>
      ) : null}
      {selectedRole !== "owner" ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Setting Role Akses hanya tersedia untuk Owner.
        </p>
      ) : null}
    </CollapsibleSection>
  );
}

function RoleMetric(props: { label: string; value: string; tone: "blue" | "emerald" | "amber" | "violet" }) {
  const tone = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
  }[props.tone];
  return (
    <div className={`rounded-lg border p-3 shadow-sm ${tone}`}>
      <p className="text-xs opacity-80">{props.label}</p>
      <p className="mt-1 truncate text-base font-semibold">{props.value}</p>
    </div>
  );
}

function AlertMessage(props: { message: string | null }) {
  if (!props.message) return null;
  const isSuccess = props.message.toLowerCase().includes("berhasil");
  const Icon = isSuccess ? CheckCircle2 : AlertCircle;
  const tone = isSuccess
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-destructive/30 bg-red-50 text-destructive";

  return (
    <div className={`flex items-start gap-2 rounded-md border p-3 text-sm ${tone}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{props.message}</p>
    </div>
  );
}
