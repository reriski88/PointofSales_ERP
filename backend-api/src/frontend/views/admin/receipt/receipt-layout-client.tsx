"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, FileText, GripVertical, Printer, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CollapsibleSection } from "../_components/collapsible-section";
import { useToast } from "../_components/toast-provider";
import { useRolePermissions } from "../_components/use-role-permissions";
import { useRealtimeEvents } from "@/frontend/controllers/use-realtime-events";

type ReceiptSection = "header" | "body" | "footer";
type ReceiptBlock =
  | "logo"
  | "outlet"
  | "address"
  | "cashier"
  | "receiptNumber"
  | "items"
  | "totals"
  | "payment"
  | "note";

type ReceiptLayout = {
  paperWidth: "58" | "80";
  autoPrint: boolean;
  header: ReceiptBlock[];
  body: ReceiptBlock[];
  footer: ReceiptBlock[];
  footerNote: string;
};

type ApiResponse<T> = { data: T };
type Settings = {
  receiptLayout: ReceiptLayout | null;
};
const defaultLayout: ReceiptLayout = {
  paperWidth: "58",
  autoPrint: false,
  header: ["logo", "outlet", "address", "cashier", "receiptNumber"],
  body: ["items", "totals", "payment"],
  footer: ["note"],
  footerNote: "Terima kasih",
};

const blockLabels: Record<ReceiptBlock, string> = {
  logo: "Logo outlet",
  outlet: "Nama outlet",
  address: "Alamat outlet",
  cashier: "Kasir",
  receiptNumber: "Nomor struk",
  items: "Daftar item",
  totals: "Subtotal / total",
  payment: "Pembayaran",
  note: "Catatan footer",
};

const sectionLabels: Record<ReceiptSection, string> = {
  header: "Header",
  body: "Isi Struk",
  footer: "Footer",
};

export function ReceiptLayoutClient() {
  const access = useRolePermissions("receipt");
  const { showToast } = useToast();
  const [layout, setLayout] = useState<ReceiptLayout>(defaultLayout);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dragged, setDragged] = useState<{
    section: ReceiptSection;
    block: ReceiptBlock;
  } | null>(null);

  const previewLines = useMemo(() => buildPreview(layout), [layout]);

  async function loadSettings() {
    setIsLoading(true);
    const response = await fetch("/api/settings");
    if (response.status === 401) {
      window.location.href = "/admin/login";
      return;
    }
    if (!response.ok) {
      setMessage("Setting struk belum bisa dimuat.");
      setIsLoading(false);
      return;
    }
    const json = (await response.json()) as ApiResponse<Settings>;
    setLayout({ ...defaultLayout, ...(json.data.receiptLayout ?? {}) });
    setIsLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSettings();
  }, []);

  useRealtimeEvents({
    topics: ["settings"],
    debounceMs: 700,
    onEvent: () => void loadSettings(),
  });

  async function saveLayout() {
    setIsSaving(true);
    setMessage(null);
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiptLayout: layout }),
    });
    setIsSaving(false);
    showToast({
      tone: response.ok ? "success" : "error",
      title: response.ok
        ? "Layout struk berhasil disimpan"
        : "Layout struk gagal disimpan",
    });
  }

  function moveBlock(targetSection: ReceiptSection, targetIndex: number) {
    if (!dragged) return;
    setLayout((current) => {
      const next: ReceiptLayout = {
        ...current,
        header: [...current.header],
        body: [...current.body],
        footer: [...current.footer],
      };
      next[dragged.section] = next[dragged.section].filter(
        (block) => block !== dragged.block,
      );
      const insertIndex =
        dragged.section === targetSection
          ? Math.min(targetIndex, next[targetSection].length)
          : targetIndex;
      next[targetSection].splice(insertIndex, 0, dragged.block);
      return next;
    });
    setDragged(null);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
      <CollapsibleSection
        title="Layout Struk"
        description="Atur setting utama, lalu susun blok struk dengan drag and drop."
        showDescription
        isLoading={isLoading}
        loadingText="Memuat setting layout struk..."
        actions={
          <div className="flex items-center gap-2">
            {access.canEdit ? (
              <Button type="button" onClick={() => void saveLayout()} disabled={isSaving}>
                <Save className="h-4 w-4" />
                {isSaving ? "Menyimpan" : "Simpan Layout"}
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => void loadSettings()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        }
        collapsible={false}
      >
        <div className="grid min-w-0 gap-4 xl:grid-cols-[260px_minmax(0,1fr)] xl:items-stretch">
          <div className="min-w-0 rounded-md border bg-background p-3 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <FileText className="h-4 w-4" />
              Lebar Kertas
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(["58", "80"] as const).map((paperWidth) => {
                const selected = layout.paperWidth === paperWidth;
                return (
                  <button
                    key={paperWidth}
                    type="button"
                    disabled={!access.canEdit}
                    onClick={() => setLayout({ ...layout, paperWidth })}
                    className={`flex h-14 items-center justify-between rounded-md border px-3 text-left text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-muted/30 text-foreground hover:border-primary/40 hover:bg-primary/5"
                    }`}
                  >
                    <span>{paperWidth} mm</span>
                    {selected ? <Check className="h-4 w-4" /> : null}
                  </button>
                );
              })}
            </div>
            <label className={`mt-3 flex h-12 items-center justify-between rounded-md border px-3 text-sm font-semibold transition-colors ${
              layout.autoPrint
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-border bg-muted/30 text-foreground"
            }`}>
              <span className="flex items-center gap-2">
                <Printer className="h-4 w-4" />
                Auto print
              </span>
              <span className={`relative h-6 w-11 rounded-full transition-colors ${layout.autoPrint ? "bg-emerald-600" : "bg-muted-foreground/30"}`}>
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={layout.autoPrint}
                  disabled={!access.canEdit}
                  onChange={(event) =>
                    setLayout({ ...layout, autoPrint: event.target.checked })
                  }
                />
                <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${layout.autoPrint ? "left-6" : "left-1"}`} />
              </span>
            </label>
          </div>
          <div className="rounded-md border bg-background p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-3">
              <Label className="text-xs font-semibold text-muted-foreground">Catatan Footer</Label>
              <span className="text-[11px] text-muted-foreground">{layout.footerNote.length}/1000</span>
            </div>
            <textarea
              className="min-h-28 w-full resize-y rounded-md border bg-muted/20 px-3 py-2 text-sm leading-5 outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-background focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={layout.footerNote}
              rows={4}
              maxLength={1000}
              disabled={!access.canEdit}
              onChange={(event) =>
                setLayout({ ...layout, footerNote: event.target.value })
              }
            />
          </div>
        </div>
        <div className="mt-5 border-t pt-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Susunan Struk</h3>
              <p className="mt-1 text-xs text-muted-foreground">Header, isi struk, dan footer.</p>
            </div>
            <div className="rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs text-muted-foreground">
              {layout.paperWidth === "80" ? "42" : "32"} kolom
            </div>
          </div>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              {(["header", "body", "footer"] as ReceiptSection[]).map(
                (section) => (
                  <DropColumn
                    key={section}
                    section={section}
                    blocks={layout[section]}
                    dragged={dragged}
                    canEdit={access.canEdit}
                    onDragStart={(block) => setDragged({ section, block })}
                    onDrop={moveBlock}
                  />
                ),
              )}
            </div>
            {message ? <p className="rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">{message}</p> : null}
          </div>
        </div>
      </CollapsibleSection>

        <CollapsibleSection
          title="Preview Struk"
          description="Contoh tampilan teks yang akan dikirim ke printer thermal."
          showDescription
          collapsible={false}
        >
          <div className="rounded-lg border border-slate-700 bg-[#101820] p-4 text-[#F1FAEE] shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm text-[#A8DADC]">
              <Printer className="h-4 w-4" />
              Preview {layout.paperWidth} mm
            </div>
            <pre className="mx-auto max-h-[520px] max-w-[280px] overflow-auto whitespace-pre-wrap font-mono text-xs leading-5 thin-x-scroll thin-y-scroll">
              {previewLines.join("\n")}
            </pre>
          </div>
        </CollapsibleSection>
    </div>
  );
}

function DropColumn(props: {
  section: ReceiptSection;
  blocks: ReceiptBlock[];
  dragged: { section: ReceiptSection; block: ReceiptBlock } | null;
  canEdit: boolean;
  onDragStart: (block: ReceiptBlock) => void;
  onDrop: (section: ReceiptSection, index: number) => void;
}) {
  return (
    <div
      className="min-h-56 rounded-md border bg-background p-3 shadow-sm transition-colors hover:border-primary/30"
      onDragOver={(event) => {
        if (props.canEdit) event.preventDefault();
      }}
      onDrop={() => {
        if (props.canEdit) props.onDrop(props.section, props.blocks.length);
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-2 border-b pb-3">
        <p className="text-sm font-semibold text-foreground">{sectionLabels[props.section]}</p>
        <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">{props.blocks.length}</span>
      </div>
      <div className="space-y-2">
        {props.blocks.map((block, index) => (
          <div
            key={block}
            draggable={props.canEdit}
            onDragStart={() => {
              if (props.canEdit) props.onDragStart(block);
            }}
            onDragOver={(event) => {
              if (props.canEdit) event.preventDefault();
            }}
            onDrop={(event) => {
              event.stopPropagation();
              if (props.canEdit) props.onDrop(props.section, index);
            }}
            className={`group flex items-center gap-2 rounded-md border bg-muted/20 p-3 text-sm shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 ${
              props.canEdit ? "cursor-grab" : "cursor-default"
            } ${
              props.dragged?.block === block ? "opacity-50" : ""
            }`}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
            <span className="font-medium text-foreground">{blockLabels[block]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildPreview(layout: ReceiptLayout) {
  const width = layout.paperWidth === "80" ? 42 : 32;
  const line = "-".repeat(width);
  const lines: string[] = [];
  const center = (value: string) => {
    const safe = value.slice(0, width);
    const leftPad = Math.max(0, Math.floor((width - safe.length) / 2));
    return `${" ".repeat(leftPad)}${safe}`;
  };
  const row = (label: string, value: string) => {
    const rightSafe = value.slice(0, width);
    const leftSafe = label.slice(0, Math.max(0, width - rightSafe.length - 1));
    return `${leftSafe.padEnd(Math.max(0, width - rightSafe.length - 1))} ${rightSafe}`;
  };
  const renderBlock = (block: ReceiptBlock) => {
    if (block === "logo") lines.push(center("[Logo Outlet]"));
    if (block === "outlet") lines.push(center("POS ERP - Outlet A"));
    if (block === "address") lines.push(center("Jl. Contoh No. 1"));
    if (block === "cashier") lines.push(center("Kasir: Admin"));
    if (block === "receiptNumber") lines.push(center("No: FL-1777440000000"));
    if (block === "items") {
      lines.push(line, "Contoh Produk");
      lines.push(row("2 x Rp 10.000", "Rp 20.000"));
    }
    if (block === "totals") {
      lines.push(line, row("Subtotal", "Rp 20.000"));
      lines.push(row("TOTAL", "Rp 20.000"));
    }
    if (block === "payment") lines.push(row("Tunai", "Rp 20.000"));
    if (block === "note") lines.push(line, ...receiptNoteLines(layout.footerNote, width).map(center));
  };
  layout.header.forEach(renderBlock);
  layout.body.forEach(renderBlock);
  layout.footer.forEach(renderBlock);
  return lines;
}

function receiptNoteLines(value: string, width: number) {
  const note = value.trim() ? value : "Terima kasih";
  return note.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").flatMap((rawLine) => {
    const line = rawLine.trim();
    if (!line) return [""];
    const chunks: string[] = [];
    for (let index = 0; index < line.length; index += width) {
      chunks.push(line.slice(index, index + width));
    }
    return chunks;
  });
}
