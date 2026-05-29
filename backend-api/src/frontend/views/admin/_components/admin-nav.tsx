"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Boxes,
  Building2,
  Calculator,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageSearch,
  Settings2,
  UserCircle,
  ReceiptText,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useLanguage } from "@/frontend/controllers/language-provider";
import { allOutletsValue, useSelectedOutlet } from "@/frontend/controllers/selected-outlet-provider";
import { clearAdminDataCache, getCurrentAccess, getOutlets, getProfile } from "@/frontend/controllers/admin-data-cache";

type MenuKey =
  | "dashboard"
  | "cashier"
  | "outlets"
  | "users"
  | "roleAccess"
  | "products"
  | "inventory"
  | "reports"
  | "financialReports"
  | "receipt"
  | "profile";

type NavItem = {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  menuKey: MenuKey;
};

type NavGroup = {
  labelKey: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    labelKey: "menuGroupOperations",
    items: [
      { href: "/admin", labelKey: "dashboard", icon: LayoutDashboard, menuKey: "dashboard" },
      { href: "/admin/cashier", labelKey: "cashier", icon: Calculator, menuKey: "cashier" },
    ],
  },
  {
    labelKey: "menuGroupMasterData",
    items: [
      { href: "/admin/outlets", labelKey: "outlets", icon: Building2, menuKey: "outlets" },
      { href: "/admin/products", labelKey: "products", icon: Boxes, menuKey: "products" },
      { href: "/admin/inventory", labelKey: "inventory", icon: PackageSearch, menuKey: "inventory" },
      { href: "/admin/users", labelKey: "usersCashiers", icon: Users, menuKey: "users" },
    ],
  },
  {
    labelKey: "menuGroupMonitoring",
    items: [
      { href: "/admin/reports", labelKey: "reports", icon: BarChart3, menuKey: "reports" },
      { href: "/admin/financial-reports", labelKey: "financialReports", icon: FileSpreadsheet, menuKey: "financialReports" },
    ],
  },
  {
    labelKey: "menuGroupSettings",
    items: [
      { href: "/admin/receipt", labelKey: "receipt", icon: ReceiptText, menuKey: "receipt" },
      { href: "/admin/role-access", labelKey: "roleAccess", icon: Settings2, menuKey: "roleAccess" },
      { href: "/admin/profile", labelKey: "profile", icon: UserCircle, menuKey: "profile" },
    ],
  },
];

const navItems = navGroups.flatMap((group) => group.items);

type Outlet = { id: string; name: string; code: string };

const accessCacheKey = "pos_admin_visible_menu_keys";
const permissionsCacheKey = "pos_admin_role_permissions";
const allMenuKeys = navItems.map((item) => item.menuKey);

function noMenusVisible() {
  return new Set<MenuKey>();
}

function visibleMenuKeysFrom(permissions: Record<MenuKey, string[]>) {
  return new Set(
    allMenuKeys.filter((key) => permissions[key]?.includes("view")),
  );
}

function cacheMenuKeys(keys: Set<MenuKey>) {
  window.sessionStorage.setItem(accessCacheKey, JSON.stringify([...keys]));
}

function initialVisibleMenuKeys() {
  if (typeof window === "undefined") {
    return new Set<MenuKey>(allMenuKeys);
  }

  const cached = window.sessionStorage.getItem(accessCacheKey);
  if (!cached) {
    return new Set<MenuKey>(allMenuKeys);
  }

  try {
    const parsed = JSON.parse(cached);
    if (!Array.isArray(parsed)) {
      return new Set<MenuKey>(allMenuKeys);
    }
    return new Set(
      parsed.filter((key): key is MenuKey =>
        allMenuKeys.includes(key as MenuKey),
      ),
    );
  } catch {
    return new Set<MenuKey>(allMenuKeys);
  }
}

export function AdminNav() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { selectedOutletId, setSelectedOutletId } = useSelectedOutlet();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [canSelectAllOutlets, setCanSelectAllOutlets] = useState(false);
  const [visibleMenuKeys, setVisibleMenuKeys] = useState<Set<MenuKey>>(
    initialVisibleMenuKeys,
  );

  const logout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      window.sessionStorage.removeItem(accessCacheKey);
      window.sessionStorage.removeItem(permissionsCacheKey);
      clearAdminDataCache();
      await fetch("/api/auth/sign-out", { method: "POST" });
    } finally {
      window.location.href = "/admin/login";
    }
  }, []);

  useEffect(() => {
    const idleMs = 15 * 60 * 1000;
    let timer: number | undefined;
    const resetTimer = () => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
      timer = window.setTimeout(() => void logout(), idleMs);
    };
    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "pointerdown",
    ];

    resetTimer();
    events.forEach((eventName) =>
      window.addEventListener(eventName, resetTimer, { passive: true }),
    );

    return () => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
      events.forEach((eventName) =>
        window.removeEventListener(eventName, resetTimer),
      );
    };
  }, [logout]);

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentContext() {
      try {
        const [access, profile, nextOutlets] = await Promise.all([
          getCurrentAccess(),
          getProfile(),
          getOutlets(),
        ]);
        if (!cancelled) {
          const nextKeys = visibleMenuKeysFrom(access.permissions);
          setVisibleMenuKeys(nextKeys);
          cacheMenuKeys(nextKeys);
          const nextCanSelectAll = ["owner", "auditor"].includes(profile.role);
          setOutlets(nextOutlets);
          setCanSelectAllOutlets(nextCanSelectAll);
          const hasSelectedOutlet =
            selectedOutletId === allOutletsValue
              ? nextCanSelectAll
              : nextOutlets.some((outlet) => outlet.id === selectedOutletId);
          if (!hasSelectedOutlet) {
            setSelectedOutletId(nextCanSelectAll ? allOutletsValue : (nextOutlets[0]?.id ?? ""));
          }
        }
      } catch {
        if (!cancelled) {
          setVisibleMenuKeys(noMenusVisible());
        }
      }
    }

    void loadCurrentContext();
    return () => {
      cancelled = true;
    };
  }, [selectedOutletId, setSelectedOutletId]);

  useEffect(() => {
    if (!isMobileSidebarOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileSidebarOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isMobileSidebarOpen]);

  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-card/95 px-4 py-3 shadow-sm backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E63946] text-white transition-colors hover:bg-[#E63946]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="Buka sidebar menu"
              aria-controls="admin-mobile-sidebar"
              aria-expanded={isMobileSidebarOpen}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-primary">POS Cemilan</p>
              <h1 className="truncate text-lg font-semibold">
                {t("backendDashboard")}
              </h1>
            </div>
          </div>
          <div className="shrink-0">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-foreground hover:bg-muted disabled:opacity-60"
              onClick={() => void logout()}
              disabled={isLoggingOut}
              aria-label={t("logout")}
              title={t("logout")}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-40 bg-black/45 transition-opacity lg:hidden ${
          isMobileSidebarOpen
            ? "opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsMobileSidebarOpen(false)}
        aria-hidden="true"
      />

      <aside
        id="admin-mobile-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[86vw] flex-col border-r bg-[#1D3557] text-white shadow-xl transition-transform duration-200 lg:hidden ${
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <AdminSidebarContent
          pathname={pathname}
          onLogout={logout}
          isLoggingOut={isLoggingOut}
          visibleMenuKeys={visibleMenuKeys}
          outlets={outlets}
          selectedOutletId={selectedOutletId}
          canSelectAllOutlets={canSelectAllOutlets}
          onSelectedOutletChange={setSelectedOutletId}
          onClose={() => setIsMobileSidebarOpen(false)}
          showCloseButton
        />
      </aside>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r bg-[#1D3557] text-white shadow-xl lg:flex">
        <AdminSidebarContent
          pathname={pathname}
          onLogout={logout}
          isLoggingOut={isLoggingOut}
          visibleMenuKeys={visibleMenuKeys}
          outlets={outlets}
          selectedOutletId={selectedOutletId}
          canSelectAllOutlets={canSelectAllOutlets}
          onSelectedOutletChange={setSelectedOutletId}
        />
      </aside>
    </>
  );
}

function AdminSidebarContent(props: {
  pathname: string;
  onLogout: () => Promise<void>;
  isLoggingOut: boolean;
  visibleMenuKeys: Set<MenuKey>;
  outlets: Outlet[];
  selectedOutletId: string;
  canSelectAllOutlets: boolean;
  onSelectedOutletChange: (outletId: string) => void;
  onClose?: () => void;
  showCloseButton?: boolean;
}) {
  const { t } = useLanguage();
  const navRef = useRef<HTMLElement>(null);
  const pressedResetTimerRef = useRef<number | undefined>(undefined);
  const [pressedHref, setPressedHref] = useState<string | null>(null);

  const handleMenuPress = useCallback((href: string) => {
    setPressedHref(href);
    if (pressedResetTimerRef.current !== undefined) {
      window.clearTimeout(pressedResetTimerRef.current);
    }
    pressedResetTimerRef.current = window.setTimeout(() => {
      setPressedHref(null);
      pressedResetTimerRef.current = undefined;
    }, 1500);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const activeMenu = navRef.current?.querySelector(
        '[data-active-menu="true"]',
      );
      activeMenu?.scrollIntoView({ block: "center" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [props.pathname]);

  useEffect(() => {
    return () => {
      if (pressedResetTimerRef.current !== undefined) {
        window.clearTimeout(pressedResetTimerRef.current);
      }
    };
  }, []);

  return (
    <>
      <div className="shrink-0 border-b border-white/10 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#E63946]">
            <ReceiptText className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#A8DADC]">POS Cemilan</p>
            <h1 className="truncate text-xl font-semibold">
              {t("adminConsole")}
            </h1>
          </div>
          {props.showCloseButton ? (
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              onClick={props.onClose}
              aria-label="Tutup sidebar menu"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <div className="mt-4 space-y-2">
          <label className="text-xs font-semibold uppercase text-[#A8DADC]">
            {t("activeOutlet")}
          </label>
          <select
            className="h-10 w-full rounded-md border border-white/15 bg-white/10 px-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-white [&_option]:text-foreground"
            value={props.selectedOutletId}
            onChange={(event) => props.onSelectedOutletChange(event.target.value)}
          >
            {props.canSelectAllOutlets ? <option value={allOutletsValue}>{t("allOutlets")}</option> : null}
            {props.outlets.map((outlet) => (
              <option key={outlet.id} value={outlet.id}>
                {outlet.name} ({outlet.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      <nav
        ref={navRef}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex min-h-full flex-col gap-5">
          <div className="space-y-5">
            {navGroups.slice(0, -1).map((group) => (
              <NavGroupSection
                key={group.labelKey}
                group={group}
                pathname={props.pathname}
                visibleMenuKeys={props.visibleMenuKeys}
                pressedHref={pressedHref}
                onPress={handleMenuPress}
                onClose={props.onClose}
              />
            ))}
          </div>

          <div className="mt-auto border-t border-white/10 pt-4">
            <NavGroupSection
              group={navGroups[navGroups.length - 1]}
              pathname={props.pathname}
              visibleMenuKeys={props.visibleMenuKeys}
              pressedHref={pressedHref}
              onPress={handleMenuPress}
              onClose={props.onClose}
            />
          </div>
        </div>
      </nav>

      <div className="m-3 shrink-0 rounded-lg border border-white/10 bg-white/10 p-3">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[#A8DADC]">
          <ShieldCheck className="h-4 w-4" />
          Session
        </div>
        <button
          type="button"
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#E63946] px-3 text-sm font-medium text-white transition-colors hover:bg-[#E63946]/90 disabled:opacity-60"
          onClick={() => void props.onLogout()}
          disabled={props.isLoggingOut}
        >
          <LogOut className="h-4 w-4" />
          {props.isLoggingOut ? t("loggingOut") : t("logout")}
        </button>
      </div>
    </>
  );
}

function NavGroupSection(props: {
  group: NavGroup;
  pathname: string;
  visibleMenuKeys: Set<MenuKey>;
  pressedHref: string | null;
  onPress: (href: string) => void;
  onClose?: () => void;
}) {
  const { t } = useLanguage();
  const visibleItems = props.group.items.filter((item) =>
    props.visibleMenuKeys.has(item.menuKey),
  );

  if (!visibleItems.length) {
    return null;
  }

  return (
    <section className="space-y-1.5">
      <p className="px-3 text-[11px] font-semibold uppercase text-[#A8DADC]">
        {t(props.group.labelKey)}
      </p>
      <div className="space-y-1">
        {visibleItems.map((item) => {
          const active =
            item.href === "/admin"
              ? props.pathname === item.href
              : props.pathname.startsWith(item.href);
          const pressed = props.pressedHref === item.href && !active;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              onPointerDown={() => props.onPress(item.href)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  props.onPress(item.href);
                }
              }}
              onClick={props.onClose}
              data-active-menu={active ? "true" : undefined}
              className={`flex h-10 touch-manipulation select-none items-center gap-3 rounded-md px-3 text-sm font-medium transition-[background-color,color,box-shadow,transform] active:scale-[0.99] ${
                active
                  ? "bg-[#E63946] text-white shadow-sm"
                  : pressed
                    ? "bg-white/15 text-white shadow-sm"
                  : "text-[#F1FAEE]/85 hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function CashierBoundaryNotice() {
  const { t } = useLanguage();

  return (
    <div className="rounded-lg border border-[#A8DADC] bg-white p-4 text-sm leading-6 text-[#1D3557] shadow-sm">
      <div className="flex items-start gap-3">
        <ReceiptText className="mt-0.5 h-5 w-5 shrink-0 text-[#E63946]" />
        <p>{t("boundaryNotice")}</p>
      </div>
    </div>
  );
}
