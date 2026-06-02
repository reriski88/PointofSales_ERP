"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import Swal from "sweetalert2";
import { Button } from "@/components/ui/button";

type ToastTone = "success" | "error" | "info";
type Toast = {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
};
type ToastInput = Omit<Toast, "id">;
type ToastContextValue = {
  showToast: (toast: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: ToastInput) => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { ...toast, id }].slice(-4));
      window.setTimeout(() => removeToast(id), 4200);
    },
    [removeToast],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed right-4 top-4 z-[10050] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}

export async function confirmAction(message: string) {
  const result = await Swal.fire({
    title: "Konfirmasi Aksi",
    text: message,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Ya, lanjutkan",
    cancelButtonText: "Batal",
    reverseButtons: true,
    focusCancel: true,
    confirmButtonColor: "#E63946",
    cancelButtonColor: "#457B9D",
  });
  return result.isConfirmed;
}

function ToastItem(props: { toast: Toast; onClose: () => void }) {
  const Icon =
    props.toast.tone === "success"
      ? CheckCircle2
      : props.toast.tone === "error"
        ? AlertCircle
        : Info;
  const toneClass =
    props.toast.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : props.toast.tone === "error"
        ? "border-red-200 bg-red-50 text-red-900"
        : "border-sky-200 bg-sky-50 text-sky-900";

  return (
    <div className={`rounded-lg border p-3 shadow-lg ${toneClass}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{props.toast.title}</p>
          {props.toast.description ? (
            <p className="mt-1 text-sm opacity-85">{props.toast.description}</p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 shrink-0 p-0"
          onClick={props.onClose}
          aria-label="Tutup notifikasi"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
