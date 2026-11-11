import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { PdfReport, type PdfReportProps } from "./PdfReport";

const PAGE_W_PX = 794; // A4 width at 96 dpi, the report's layout width
const PAGE_W_MM = 210;
const PAGE_H_MM = 297;
const MM_PER_PX = PAGE_W_MM / PAGE_W_PX;
const TOP_PX = 30;
const BOTTOM_PX = 40;
const PAGE_H_PX = Math.floor(PAGE_H_MM / MM_PER_PX);
const CONTENT_H_PX = PAGE_H_PX - TOP_PX - BOTTOM_PX;

/** Page cuts (in CSS px) that fall between blocks where possible, never inside one that fits on a page. */
export function pageBreaks(total: number, blockEnds: number[], pageH = CONTENT_H_PX): [number, number][] {
  const ends = [...new Set(blockEnds)].sort((a, b) => a - b);
  const out: [number, number][] = [];
  let start = 0;
  while (start < total - 1) {
    const limit = start + pageH;
    if (limit >= total) {
      out.push([start, total]);
      break;
    }
    const fit = ends.filter((e) => e > start + pageH * 0.3 && e <= limit).at(-1);
    const end = fit ?? limit;
    out.push([start, end]);
    start = end;
  }
  return out;
}

async function imagesLoaded(el: HTMLElement): Promise<void> {
  await Promise.all(
    [...el.querySelectorAll("img")].map((img) => (img.complete ? Promise.resolve() : new Promise<void>((r) => ((img.onload = img.onerror = () => r()))))),
  );
}

/** Builds an A4 PDF of the report (Vietnamese text rendered as images, source links kept clickable) and downloads it. */
export async function exportReportPdf(props: Omit<PdfReportProps, "qr" | "generatedAt">): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }, QR] = await Promise.all([import("html2canvas-pro"), import("jspdf"), import("qrcode")]);
  const qr: Record<string, string> = {};
  await Promise.all(
    Object.values(props.report.sources ?? {}).map(async (s) => {
      qr[s.id] = await QR.toDataURL(s.url, { margin: 0, width: 160, errorCorrectionLevel: "M" });
    }),
  );

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${PAGE_W_PX}px;background:#fff;`;
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    const generatedAt = new Date();
    flushSync(() => root.render(<PdfReport {...props} qr={qr} generatedAt={generatedAt} />));
    const el = host.firstElementChild as HTMLElement;
    await document.fonts.ready;
    await imagesLoaded(el);

    const origin = el.getBoundingClientRect();
    const rel = (n: Element) => {
      const r = n.getBoundingClientRect();
      return { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height };
    };
    const blockEnds = [...el.querySelectorAll("[data-pdf-block]")].map((b) => {
      const r = rel(b);
      return Math.ceil(r.y + r.h + 8); // include the gap after the block
    });
    const links = [...el.querySelectorAll<HTMLElement>("[data-pdf-link]")].map((n) => ({ url: n.dataset.pdfLink!, ...rel(n) }));
    const total = el.scrollHeight;

    const scale = 2;
    const canvas = await html2canvas(el, { scale, backgroundColor: "#ffffff", useCORS: true, logging: false });
    const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
    const pages = pageBreaks(total, blockEnds);
    pages.forEach(([from, to], i) => {
      if (i > 0) pdf.addPage();
      const h = to - from;
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = Math.round(h * scale);
      slice.getContext("2d")!.drawImage(canvas, 0, Math.round(from * scale), canvas.width, slice.height, 0, 0, canvas.width, slice.height);
      pdf.addImage(slice.toDataURL("image/jpeg", 0.9), "JPEG", 0, TOP_PX * MM_PER_PX, PAGE_W_MM, h * MM_PER_PX);
      for (const l of links) {
        if (l.y >= from && l.y + l.h <= to) pdf.link(l.x * MM_PER_PX, (TOP_PX + l.y - from) * MM_PER_PX, l.w * MM_PER_PX, l.h * MM_PER_PX, { url: l.url });
      }
      pdf.setFontSize(8);
      pdf.setTextColor(120);
      pdf.text(`DRUG-GUARD AI  -  ${i + 1}/${pages.length}`, PAGE_W_MM / 2, PAGE_H_MM - 8, { align: "center" });
    });
    const stamp = generatedAt.toISOString().slice(0, 10);
    pdf.save(`drug-guard-bao-cao-${stamp}.pdf`);
  } finally {
    root.unmount();
    host.remove();
  }
}
