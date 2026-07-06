"use client";

import { useSubscriptionStatus } from "@/frontend/controllers/use-subscription-status";
import { AlertTriangle, Clock, Info } from "lucide-react";

export function SubscriptionBanner() {
  const { info, loading } = useSubscriptionStatus();

  if (loading || !info) return null;
  if (info.healthy) return null;

  const gradient = "from-amber-50 to-orange-50";
  const border = "border-amber-200";
  const text = "text-amber-800";
  const icon = info.isExpired ? <AlertTriangle size={18} /> : <Clock size={18} />;

  const message = info.isExpired
    ? `Langganan ${info.planName} telah berakhir. Hubungi IT Support untuk perpanjangan.`
    : info.isGrace
      ? `Masa tenggang langganan ${info.planName} tersisa beberapa hari. Segera perpanjang.`
      : `Langganan ${info.planName} perlu perhatian.`;

  return (
    <div className={`border ${border} bg-gradient-to-r ${gradient} px-4 py-2.5 ${text}`}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {message}
      </div>
    </div>
  );
}
