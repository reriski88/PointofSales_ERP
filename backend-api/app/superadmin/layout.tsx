import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { LayoutDashboard, Building2, CreditCard, Sparkles } from "lucide-react";
import { SuperadminLogoutButton } from "@/frontend/views/superadmin/logout-button";

async function getSuperadminSession() {
  try {
    const h = await headers();
    const proto = h.get("x-forwarded-proto") ?? "http";
    const host = h.get("host") ?? "localhost:3001";
    const res = await fetch(`${proto}://${host}/api/role-access/me`, {
      headers: { cookie: h.get("cookie") ?? "" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.role === "superadmin" ? json.data : null;
  } catch {
    return null;
  }
}

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSuperadminSession();
  if (!session) redirect("/admin/login");

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-purple-50 to-rose-50 text-slate-900">
      <aside className="fixed inset-y-4 left-4 z-20 hidden w-72 overflow-hidden rounded-[2rem] border border-white/80 bg-white/90 shadow-xl shadow-purple-200/30 backdrop-blur-xl lg:flex lg:flex-col">
        <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-gradient-to-br from-sky-200 to-cyan-200 blur-2xl opacity-60" />
        <div className="absolute -bottom-12 left-6 h-40 w-40 rounded-full bg-gradient-to-br from-purple-200 to-pink-200 blur-3xl opacity-50" />
        <div className="relative p-6">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-300/40">
            <Sparkles size={22} />
          </div>
          <h1 className="mt-4 text-xl font-black tracking-tight text-slate-800">POS Command</h1>
          <p className="mt-1 text-sm text-slate-400">Superadmin SaaS Control Center</p>
        </div>
        <nav className="relative flex-1 space-y-2 px-4">
          <SidebarLink href="/superadmin" icon={<LayoutDashboard size={18} />} label="Dashboard" />
          <SidebarLink href="/superadmin/tenants" icon={<Building2 size={18} />} label="Tenant" />
          <SidebarLink href="/superadmin/plans" icon={<CreditCard size={18} />} label="Plan Langganan" />
        </nav>
        <div className="relative p-4">
          <SuperadminLogoutButton />
        </div>
      </aside>
      <main className="min-h-screen p-4 lg:pl-80 lg:pr-6 lg:pt-6">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/80 bg-white/70 p-5 shadow-xl shadow-purple-200/20 backdrop-blur md:p-8">{children}</div>
      </main>
    </div>
  );
}

function SidebarLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-500 transition hover:bg-purple-50 hover:text-purple-700">
      <span className="rounded-xl bg-slate-100 p-2 text-slate-500 transition group-hover:bg-purple-500 group-hover:text-white">{icon}</span>
      {label}
    </Link>
  );
}
