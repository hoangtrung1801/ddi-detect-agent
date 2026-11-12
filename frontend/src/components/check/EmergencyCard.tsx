import { Phone, Siren } from "lucide-react";
import type { InteractionReport } from "@/lib/report";
import { SourceTags } from "./Evidence";

/** Warning signs that the cited sources say need urgent care, with a one-tap emergency call. */
export function EmergencyCard({ report }: { report: InteractionReport }) {
  const seen = new Map<string, string[]>();
  for (const p of report.pairs) {
    for (const c of p.analysis?.consequences ?? []) {
      if (!c.urgent) continue;
      seen.set(c.text, [...(seen.get(c.text) ?? []), ...c.sources]);
    }
  }
  if (!seen.size) return null;
  return (
    <section aria-labelledby="sos-title" className="flex flex-col gap-3 rounded-2xl border-2 border-sev-major bg-sev-major-soft px-5 py-4 sm:px-6">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sev-major text-white">
          <Siren className="size-5" aria-hidden="true" />
        </span>
        <div className="flex flex-col">
          <h2 id="sos-title" className="text-[17px] font-bold text-sev-major-ink">
            Đi cấp cứu hoặc gọi bác sĩ ngay nếu có
          </h2>
          <p className="text-sm text-sev-major-ink/90">Theo hướng dẫn trong tài liệu gốc của các thuốc này.</p>
        </div>
      </div>
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-2">
        {[...seen].map(([text, ids]) => (
          <li key={text} className="rounded-xl bg-card px-3.5 py-2.5 text-[15px] leading-snug font-semibold text-sev-major-ink">
            {text}
            <SourceTags ids={ids} sources={report.sources ?? {}} />
          </li>
        ))}
      </ul>
      <a
        href="tel:115"
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-sev-major text-[16px] font-bold text-white hover:bg-sev-major/90 sm:w-fit sm:px-6 print:hidden"
      >
        <Phone className="size-5" aria-hidden="true" />
        Gọi cấp cứu 115
      </a>
    </section>
  );
}
