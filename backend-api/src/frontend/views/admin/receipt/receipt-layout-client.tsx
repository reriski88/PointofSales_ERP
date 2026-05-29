"use client";

import { useEffect, useMemo, useState } from "react";
import { GripVertical, Printer, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CollapsibleSection } from "../_components/collapsible-section";
import { useToast } from "../_components/toast-provider";
import { useRolePermissions } from "../_components/use-role-permissions";

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

  async function saveLayout() {
    setIsSaving(true);
    setMessage(null);
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiptLayout: layout }),
    });
    setIsSaving(false);
    setMessage(
      response.ok
        ? "Layout struk berhasil disimpan."
        : "Layout struk gagal disimpan.",
    );
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
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <CollapsibleSection
        title="Setting Layout Struk"
        description="Susun bagian struk dengan drag and drop. Mobile kasir akan memakai layout ini saat print."
        isLoading={isLoading}
        loadingText="Memuat setting layout struk..."
        actions={
          <Button type="button" variant="outline" onClick={() => void loadSettings()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        }
        collapsible={false}
      >
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Lebar Kertas</Label>
              <select
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={layout.paperWidth}
                disabled={!access.canEdit}
                onChange={(event) =>
                  setLayout({
                    ...layout,
                    paperWidth: event.target.value as "58" | "80",
                  })
                }
              >
                <option value="58">58 mm</option>
                <option value="80">80 mm</option>
              </select>
            </div>
            <label className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={layout.autoPrint}
                disabled={!access.canEdit}
                onChange={(event) =>
                  setLayout({ ...layout, autoPrint: event.target.checked })
                }
              />
              Print otomatis setelah transaksi selesai
            </label>
            <div className="space-y-2">
              <Label>Catatan Footer</Label>
              <Input
                value={layout.footerNote}
                disabled={!access.canEdit}
                onChange={(event) =>
                  setLayout({ ...layout, footerNote: event.target.value })
                }
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
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

          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          {access.canEdit ? (
            <Button type="button" onClick={() => void saveLayout()} disabled={isSaving}>
              <Save className="h-4 w-4" />
              {isSaving ? "Menyimpan" : "Simpan Layout"}
            </Button>
          ) : null}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Preview Struk"
        description="Contoh tampilan teks yang akan dikirim ke printer thermal."
        collapsible={false}
      >
        <div className="rounded-lg border bg-[#101820] p-4 text-[#F1FAEE]">
          <div className="mb-3 flex items-center gap-2 text-sm text-[#A8DADC]">
            <Printer className="h-4 w-4" />
            Preview {layout.paperWidth} mm
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-5">
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
      className="min-h-56 rounded-lg border bg-muted/25 p-3"
      onDragOver={(event) => {
        if (props.canEdit) event.preventDefault();
      }}
      onDrop={() => {
        if (props.canEdit) props.onDrop(props.section, props.blocks.length);
      }}
    >
      <p className="mb-3 font-semibold">{sectionLabels[props.section]}</p>
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
            className={`flex items-center gap-2 rounded-md border bg-background p-3 text-sm shadow-sm ${
              props.canEdit ? "cursor-grab" : "cursor-default"
            } ${
              props.dragged?.block === block ? "opacity-50" : ""
            }`}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            {blockLabels[block]}
          </div>
        ))}
      </div>
    </div>
  );
}

function buildPreview(layout: ReceiptLayout) {
  const line = layout.paperWidth === "80" ? "-".repeat(42) : "-".repeat(32);
  const lines: string[] = [];
  const renderBlock = (block: ReceiptBlock) => {
    if (block === "logo") lines.push("[Logo Outlet]");
    if (block === "outlet") lines.push("POS CEMILAN - Outlet A");
    if (block === "address") lines.push("Jl. Contoh No. 1");
    if (block === "cashier") lines.push("Kasir: Admin");
    if (block === "receiptNumber") lines.push("No: FL-1777440000000");
    if (block === "items") {
      lines.push(line, "Keripik Pedas");
      lines.push("2 x Rp 10.000        Rp 20.000");
    }
    if (block === "totals") {
      lines.push(line, "Subtotal             Rp 20.000");
      lines.push("Diskon                    Rp 0");
      lines.push("TOTAL                Rp 20.000");
    }
    if (block === "payment") lines.push("Tunai                Rp 20.000");
    if (block === "note") lines.push(line, layout.footerNote);
  };
  layout.header.forEach(renderBlock);
  layout.body.forEach(renderBlock);
  layout.footer.forEach(renderBlock);
  return lines;
}
