"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export const allOutletsValue = "__all_outlets__";
const selectedOutletStorageKey = "pos_admin_selected_outlet_id";
const selectedOutletEvent = "pos:selected-outlet-change";

type SelectedOutletContextValue = {
  selectedOutletId: string;
  setSelectedOutletId: (outletId: string) => void;
};

const SelectedOutletContext = createContext<SelectedOutletContextValue | null>(null);

export function SelectedOutletProvider({ children }: { children: ReactNode }) {
  const [selectedOutletId, setSelectedOutletIdState] = useState("");
  const setSelectedOutletId = useCallback((outletId: string) => {
    window.sessionStorage.setItem(selectedOutletStorageKey, outletId);
    setSelectedOutletIdState(outletId);
    window.dispatchEvent(new Event(selectedOutletEvent));
  }, []);

  useEffect(() => {
    const onOutletChange = () => {
      setSelectedOutletIdState(window.sessionStorage.getItem(selectedOutletStorageKey) ?? "");
    };
    onOutletChange();
    window.addEventListener(selectedOutletEvent, onOutletChange);
    return () => window.removeEventListener(selectedOutletEvent, onOutletChange);
  }, []);

  const value = useMemo<SelectedOutletContextValue>(
    () => ({
      selectedOutletId,
      setSelectedOutletId,
    }),
    [selectedOutletId, setSelectedOutletId],
  );

  return <SelectedOutletContext.Provider value={value}>{children}</SelectedOutletContext.Provider>;
}

export function useSelectedOutlet() {
  const context = useContext(SelectedOutletContext);
  if (!context) {
    throw new Error("useSelectedOutlet must be used inside SelectedOutletProvider");
  }
  return context;
}

export function saveSelectedOutlet(outletId: string) {
  window.sessionStorage.setItem(selectedOutletStorageKey, outletId);
  window.dispatchEvent(new Event(selectedOutletEvent));
}

export function clearSelectedOutlet() {
  window.sessionStorage.removeItem(selectedOutletStorageKey);
  window.dispatchEvent(new Event(selectedOutletEvent));
}
