"use client";

type BrowserReceiptPrintOptions = {
  title: string;
  paperWidth: "58" | "80";
  logoUrl?: string | null;
  showLogo?: boolean;
};

export async function printReceiptViaBrowser(text: string, options: BrowserReceiptPrintOptions) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const widthMm = options.paperWidth === "80" ? 72 : 48;
  const fontPx = options.paperWidth === "80" ? 11 : 10;
  const lineHeightMm = options.paperWidth === "80" ? 3.8 : 3.7;
  const lineCount = Math.max(1, text.split("\n").length);
  const logoHeightMm = options.showLogo && options.logoUrl ? 22 : 0;
  const bottomFeedMm = options.paperWidth === "80" ? 3 : 2.5;
  const pageHeightMm = Math.max(110, Math.min(2000, Math.ceil(12 + logoHeightMm + bottomFeedMm + lineCount * lineHeightMm)));

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = `${widthMm}mm`;
  iframe.style.height = `${pageHeightMm}mm`;
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    return;
  }

  const inlineLogoUrl = await buildInlineLogoUrl(options.logoUrl, options.showLogo ?? false);
  const logoHtml = inlineLogoUrl
    ? `<img class="receipt-logo" src="${escapeHtml(inlineLogoUrl)}" alt="Logo outlet" />`
    : "";

  doc.open();
  doc.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(options.title)}</title>
  <style>
    @page { size: ${widthMm}mm ${pageHeightMm}mm; margin: 0; }
    * { box-sizing: border-box; }
    html, body { width: ${widthMm}mm; min-height: ${pageHeightMm}mm; margin: 0; padding: 0; background: #fff; color: #000; }
    body {
      font-family: "Courier New", ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      -webkit-text-size-adjust: 100%;
      text-size-adjust: 100%;
    }
    .receipt { width: ${widthMm}mm; min-height: ${pageHeightMm}mm; padding: ${options.paperWidth === "80" ? "3mm 3mm 3mm" : "1mm 1mm 2.5mm"}; }
    .receipt-logo {
      display: block;
      width: auto;
      max-width: ${options.paperWidth === "80" ? 46 : 34}mm;
      max-height: 22mm;
      margin: 0 auto 2mm;
      object-fit: contain;
      filter: grayscale(1) contrast(1.75) brightness(0.9);
      image-rendering: auto;
    }
    pre {
      width: 100%;
      margin: 0;
      white-space: pre;
      overflow: visible;
      color: #000;
      font: 700 ${fontPx}px/1.25 "Courier New", ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
      letter-spacing: 0;
      tab-size: 2;
    }
    .feed { height: ${bottomFeedMm}mm; }
    @media print {
      html, body { width: ${widthMm}mm; min-height: ${pageHeightMm}mm; overflow: visible; }
      .receipt { break-inside: avoid; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <main class="receipt">
    ${logoHtml}
    <pre>${escapeHtml(text)}</pre>
    <div class="feed" aria-hidden="true"></div>
  </main>
</body>
</html>`);
  doc.close();

  await waitForReceiptAssets(doc);
  await delay(150);
  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();
  window.setTimeout(() => iframe.remove(), 10000);
}

function waitForReceiptAssets(doc: Document) {
  const images = Array.from(doc.images);
  if (!images.length) return Promise.resolve();
  return Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }
          image.onload = () => resolve();
          image.onerror = () => resolve();
        }),
    ),
  ).then(() => undefined);
}

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

async function buildInlineLogoUrl(logoUrl: string | null | undefined, enabled: boolean) {
  if (!enabled || !logoUrl) return "";
  try {
    const inlineSource = await fetchImageDataUrl(logoUrl);
    const image = await loadImage(inlineSource || logoUrl);
    const maxWidth = 360;
    const maxHeight = 180;
    const scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return logoUrl;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.filter = "grayscale(1) contrast(1.75) brightness(0.9)";
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/png");
  } catch {
    return logoUrl;
  }
}

async function fetchImageDataUrl(src: string) {
  try {
    const url = toAbsoluteUrl(src);
    const response = await fetch(url, { credentials: "include", cache: "no-store" });
    if (!response.ok) return "";
    const blob = await response.blob();
    return await blobToDataUrl(blob);
  } catch {
    return "";
  }
}

function toAbsoluteUrl(src: string) {
  if (src.startsWith("data:")) return src;
  return new URL(src, window.location.origin).toString();
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    if (!src.startsWith("data:") && !src.startsWith(window.location.origin)) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;",
    };
    return entities[char] ?? char;
  });
}
