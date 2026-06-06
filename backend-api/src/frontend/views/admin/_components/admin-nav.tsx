"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Boxes,
  Building2,
  Calculator,
  Contact,
  BadgePercent,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageSearch,
  Settings2,
  ShoppingBag,
  ArrowRightLeft,
  ClipboardList,
  UserCircle,
  ReceiptText,
  Ruler,
  ShieldCheck,
  Truck,
  Users,
  X,
} from "lucide-react";
import { AdminTour } from "./admin-tour";
import { useLanguage } from "@/frontend/controllers/language-provider";
import {
  allOutletsValue,
  clearSelectedOutlet,
  useSelectedOutlet,
} from "@/frontend/controllers/selected-outlet-provider";
import {
  clearAdminDataCache,
  getCurrentAccess,
  getOutlets,
  getProfile,
} from "@/frontend/controllers/admin-data-cache";
import { confirmAction } from "./toast-provider";
// import { AiChatWidget } from "./ai-chat-widget";
import { SearchableSelect } from "./searchable-select";

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
      {
        href: "/admin",
        labelKey: "dashboard",
        icon: LayoutDashboard,
        menuKey: "dashboard",
      },
      {
        href: "/admin/cashier",
        labelKey: "cashier",
        icon: Calculator,
        menuKey: "cashier",
      },
    ],
  },
  {
    labelKey: "menuGroupMasterData",
    items: [
      {
        href: "/admin/outlets",
        labelKey: "outlets",
        icon: Building2,
        menuKey: "outlets",
      },
      {
        href: "/admin/products",
        labelKey: "products",
        icon: Boxes,
        menuKey: "products",
      },
      {
        href: "/admin/units",
        labelKey: "units",
        icon: Ruler,
        menuKey: "products",
      },
      {
        href: "/admin/customers",
        labelKey: "customers",
        icon: Contact,
        menuKey: "customers",
      },
      {
        href: "/admin/promotions",
        labelKey: "promotions",
        icon: BadgePercent,
        menuKey: "promotions",
      },
      {
        href: "/admin/inventory",
        labelKey: "inventory",
        icon: PackageSearch,
        menuKey: "inventory",
      },
      {
        href: "/admin/transfers",
        labelKey: "stockTransfers",
        icon: ArrowRightLeft,
        menuKey: "inventory",
      },
      {
        href: "/admin/stock-opname",
        labelKey: "stockOpname",
        icon: ClipboardList,
        menuKey: "stockOpname",
      },
      {
        href: "/admin/suppliers",
        labelKey: "suppliers",
        icon: Truck,
        menuKey: "suppliers",
      },
      {
        href: "/admin/purchases",
        labelKey: "purchases",
        icon: ShoppingBag,
        menuKey: "purchases",
      },
      {
        href: "/admin/users",
        labelKey: "usersCashiers",
        icon: Users,
        menuKey: "users",
      },
    ],
  },
  {
    labelKey: "menuGroupMonitoring",
    items: [
      {
        href: "/admin/reports",
        labelKey: "reports",
        icon: BarChart3,
        menuKey: "reports",
      },
      {
        href: "/admin/financial-reports",
        labelKey: "financialReports",
        icon: FileSpreadsheet,
        menuKey: "financialReports",
      },
    ],
  },
  {
    labelKey: "menuGroupSettings",
    items: [
      {
        href: "/admin/receipt",
        labelKey: "receipt",
        icon: ReceiptText,
        menuKey: "receipt",
      },
      {
        href: "/admin/role-access",
        labelKey: "roleAccess",
        icon: Settings2,
        menuKey: "roleAccess",
      },
      {
        href: "/admin/profile",
        labelKey: "profile",
        icon: UserCircle,
        menuKey: "profile",
      },
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
  return new Set<MenuKey>(allMenuKeys);
}

export function AdminNav() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { selectedOutletId, setSelectedOutletId } = useSelectedOutlet();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [canSelectAllOutlets, setCanSelectAllOutlets] = useState(false);
  const [profileName, setProfileName] = useState<string>("");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [profileRole, setProfileRole] = useState<string | null>(null);
  const [visibleMenuKeys, setVisibleMenuKeys] = useState<Set<MenuKey>>(
    initialVisibleMenuKeys,
  );

  const logout = useCallback(async (options?: { skipConfirm?: boolean }) => {
    if (
      !options?.skipConfirm &&
      !(await confirmAction("Yakin ingin keluar dari dashboard?"))
    ) {
      return;
    }
    setIsLoggingOut(true);
    try {
      window.sessionStorage.removeItem(accessCacheKey);
      window.sessionStorage.removeItem(permissionsCacheKey);
      clearAdminDataCache();
      clearSelectedOutlet();
      await fetch("/api/auth/sign-out", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
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
      timer = window.setTimeout(() => void logout({ skipConfirm: true }), idleMs);
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
          getOutlets({ force: true }),
        ]);
        if (!cancelled) {
          const nextKeys = visibleMenuKeysFrom(access.permissions);
          setVisibleMenuKeys(nextKeys);
          cacheMenuKeys(nextKeys);
          setProfileName(profile.name ?? "Admin");
          setProfileImage(profile.image ?? null);
          setProfileRole(profile.role);
          const nextCanSelectAll =
            ["owner", "auditor"].includes(profile.role) &&
            nextOutlets.length > 0;
          setOutlets(nextOutlets);
          setCanSelectAllOutlets(nextCanSelectAll);
          const requiresFirstRunSetup =
            profile.role === "owner" && nextOutlets.length === 0;
          const requiresOutletAssignment =
            profile.role !== "owner" && nextOutlets.length === 0;
          if (requiresFirstRunSetup) {
            clearSelectedOutlet();
            if (pathname !== "/admin/outlets") {
              window.location.replace("/admin/outlets?setup=first-run");
            }
            return;
          }
          if (requiresOutletAssignment) {
            clearSelectedOutlet();
            if (pathname !== "/admin/profile") {
              window.location.replace("/admin/profile?notice=no-outlet");
            }
            return;
          }
          const hasSelectedOutlet =
            selectedOutletId === allOutletsValue
              ? nextCanSelectAll && nextOutlets.length > 0
              : nextOutlets.some((outlet) => outlet.id === selectedOutletId);
          if (!hasSelectedOutlet) {
            const fallbackOutletId =
              nextCanSelectAll && nextOutlets.length > 0
                ? allOutletsValue
                : (nextOutlets[0]?.id ?? "");
            if (fallbackOutletId) {
              setSelectedOutletId(fallbackOutletId);
            } else {
              clearSelectedOutlet();
            }
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
  }, [pathname, selectedOutletId, setSelectedOutletId]);

  useEffect(() => {
    async function reloadProfile() {
      try {
        const profile = await getProfile({ force: true });
        setProfileName(profile.name ?? "Admin");
        setProfileImage(profile.image ?? null);
        setProfileRole(profile.role);
      } catch {
        // Keep previous sidebar identity.
      }
    }
    window.addEventListener("pos-profile-updated", reloadProfile);
    return () => window.removeEventListener("pos-profile-updated", reloadProfile);
  }, []);

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
              <p className="text-sm font-semibold text-primary">Smart POS ERP</p>
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
          isMobileSidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
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
          profileName={profileName}
          profileImage={profileImage}
          profileRole={profileRole}
          outlets={outlets}
          selectedOutletId={selectedOutletId}
          canSelectAllOutlets={canSelectAllOutlets}
          onSelectedOutletChange={setSelectedOutletId}
          onClose={() => setIsMobileSidebarOpen(false)}
          showCloseButton
        />
      </aside>

      <aside data-tour="sidebar" className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r bg-[#1D3557] text-white shadow-xl lg:flex">
        <AdminSidebarContent
          pathname={pathname}
          onLogout={logout}
          isLoggingOut={isLoggingOut}
          visibleMenuKeys={visibleMenuKeys}
          profileName={profileName}
          profileImage={profileImage}
          profileRole={profileRole}
          outlets={outlets}
          selectedOutletId={selectedOutletId}
          canSelectAllOutlets={canSelectAllOutlets}
          onSelectedOutletChange={setSelectedOutletId}
        />
      </aside>
      <AdminTour pathname={pathname} />
      {/* <AiChatWidget
        enabled={["owner", "admin_outlet"].includes(profileRole ?? "")}
      /> */}
    </>
  );
}

function AdminSidebarContent(props: {
  pathname: string;
  onLogout: () => Promise<void>;
  isLoggingOut: boolean;
  visibleMenuKeys: Set<MenuKey>;
  profileName: string;
  profileImage: string | null;
  profileRole: string | null;
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
          {props.profileImage ? (
            <Image
              src={props.profileImage}
              alt={`Foto ${props.profileName || "user"}`}
              width={44}
              height={44}
              unoptimized
              className="h-11 w-11 shrink-0 rounded-lg border border-white/15 bg-white/10 object-cover"
            />
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#E63946]">
              <ReceiptText className="h-6 w-6" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#A8DADC]">Smart POS ERP</p>
            <h1 className="truncate text-xl font-semibold">
              {props.profileName || t("adminConsole")}
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
        <div data-tour="outlet-select" className="mt-4 space-y-2">
          <label className="text-xs font-semibold uppercase text-[#A8DADC]">
            {t("activeOutlet")}
          </label>
          <SearchableSelect
            value={props.selectedOutletId}
            onChange={props.onSelectedOutletChange}
            placeholder={t("activeOutlet")}
            searchPlaceholder="Cari outlet..."
            emptyText="Outlet tidak ditemukan."
            triggerClassName="border-white/15 bg-white/10 text-white hover:bg-white/15 [&_svg]:text-white/80"
            dropdownClassName="bg-white text-[#1D3557]"
            options={[
              ...(props.canSelectAllOutlets
                ? [{ value: allOutletsValue, label: t("allOutlets") }]
                : []),
              ...props.outlets.map((outlet) => ({
                value: outlet.id,
                label: `${outlet.name} (${outlet.code})`,
                keywords: `${outlet.name} ${outlet.code}`,
              })),
            ]}
          />
        </div>
      </div>

      <nav
        ref={navRef}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-3 [scrollbar-color:transparent_transparent] [scrollbar-width:none] hover:[scrollbar-color:rgba(255,255,255,0.22)_transparent] hover:[scrollbar-width:thin] [&::-webkit-scrollbar]:w-0 hover:[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent"
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
          {props.profileRole ?? "Sesi"}
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
  const pathname = usePathname();
  const { t } = useLanguage();
  const activeItem = navItems.find((item) => pathname === item.href) ?? navItems.find((item) => pathname.startsWith(`${item.href}/`));
  const title = activeItem ? t(activeItem.labelKey) : t("backendDashboard");
  const activeGroup = navGroups.find((group) =>
    group.items.some((item) => item.href === activeItem?.href),
  );
  const parentLabel = activeGroup ? t(activeGroup.labelKey) : t("dashboard");

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-normal text-foreground">{title}</h1>
      <nav className="flex items-center gap-2 text-xs text-muted-foreground" aria-label="Breadcrumb">
        <span>{parentLabel}</span>
        <span>/</span>
        <span className="font-medium text-foreground">{title}</span>
      </nav>
    </div>
  );
}
