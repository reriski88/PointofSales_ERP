"use client";

import { useEffect, useState, useRef } from "react";

type SubscriptionInfo = {
  planName: string;
  planCode: string;
  priceMonthly: string;
  status: string;
  trialEndsAt: string | null;
  periodEnd: string;
  billingCycle: string;
  autoRenew: boolean | null;
  healthy: boolean;
  isTrial: boolean;
  isGrace: boolean;
  isExpired: boolean;
  limits: {
    maxOutlets: number;
    maxUsers: number;
    maxSkus: number;
  };
};

type SubscriptionResponse = {
  subscription: SubscriptionInfo | null;
  role?: string;
};

export function useSubscriptionStatus() {
  const [info, setInfo] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchStatus() {
    try {
      const res = await fetch("/api/subscription/me");
      if (!res.ok) {
        setError("Gagal memuat info subscription");
        setLoading(false);
        return;
      }
      const json = (await res.json()) as { data: SubscriptionResponse };
      const data = json.data;
      if (data?.role === "superadmin") {
        setInfo(null);
        setLoading(false);
        return;
      }
      setInfo(data?.subscription ?? null);
      setError(null);
    } catch {
      setError(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
    intervalRef.current = setInterval(fetchStatus, 120_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { info, loading, error, refetch: fetchStatus };
}
