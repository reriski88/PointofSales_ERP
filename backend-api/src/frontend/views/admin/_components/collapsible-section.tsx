"use client";

import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { AdminModal } from "./admin-modal";

export function CollapsibleSection(props: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  isLoading?: boolean;
  loadingText?: string;
  collapsible?: boolean;
  showDescription?: boolean;
}) {
  const modalSection = /^(Tambah|Buat|Setup|Form)/i.test(props.title);
  const [open, setOpen] = useState(false);
  if (modalSection) {
    return (
      <>
        <div data-tour="section" className={["flex items-center justify-between gap-3 rounded-lg border border-dashed bg-card px-4 py-3 shadow-sm", props.className].filter(Boolean).join(" ")}>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{props.title}</p>
            {props.description ? (
              props.actions ? <p className="mt-1 text-xs leading-4 text-muted-foreground">{props.description}</p> : <p className="sr-only">{props.description}</p>
            ) : null}
          </div>
          <button type="button" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setOpen(true)} aria-label={props.title} title={props.title}>
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <AdminModal open={open} title={props.title} description={typeof props.description === "string" ? props.description : undefined} size="xl" onClose={() => setOpen(false)}>
          {props.isLoading ? <SectionLoading text={props.loadingText ?? "Memuat data section..."} /> : props.children}
        </AdminModal>
      </>
    );
  }

  return (
    <section data-tour="section" className={["h-fit overflow-hidden rounded-lg border bg-card shadow-sm", props.className].filter(Boolean).join(" ")}>
      <div className="border-b bg-card px-5 py-4">
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold leading-snug text-foreground">{props.title}</h2>
            {props.description ? (
              props.showDescription ? <p className="mt-1 text-xs leading-4 text-muted-foreground">{props.description}</p> : <p className="sr-only">{props.description}</p>
            ) : null}
          </div>
          {props.actions ? <div className="flex shrink-0 items-center justify-end gap-2">{props.actions}</div> : null}
        </div>
      </div>
      <div className="p-4">
        {props.isLoading ? <SectionLoading text={props.loadingText ?? "Memuat data section..."} /> : props.children}
      </div>
    </section>
  );
}

function SectionLoading(props: { text: string }) {
  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        {props.text}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <span className="h-12 animate-pulse rounded-md bg-muted" />
        <span className="h-12 animate-pulse rounded-md bg-muted" />
        <span className="h-12 animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  );
}
