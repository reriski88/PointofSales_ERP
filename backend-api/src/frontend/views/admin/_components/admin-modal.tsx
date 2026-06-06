"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function AdminModal(props: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  size?: "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!props.open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [props]);

  if (!props.open) return null;
  const widthClass = props.size === "xl" ? "max-w-5xl" : props.size === "lg" ? "max-w-3xl" : "max-w-xl";
  const modal = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 p-3" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0" onClick={props.onClose} aria-label="Tutup modal" />
      <div className={`relative flex max-h-[92vh] w-full ${widthClass} flex-col overflow-hidden rounded-xl bg-card shadow-xl`}>
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">{props.title}</h2>
            {props.description ? <p className="mt-1 text-sm text-muted-foreground">{props.description}</p> : null}
          </div>
          <button type="button" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background hover:bg-muted" onClick={props.onClose} aria-label="Tutup">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="thin-y-scroll min-h-0 overflow-y-auto p-5">{props.children}</div>
      </div>
    </div>
  );
  return typeof document === "undefined" ? modal : createPortal(modal, document.body);
}
