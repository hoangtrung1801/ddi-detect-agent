import { BadgeCheck, Database, FileText, ScanSearch } from "lucide-react";
import type { InteractionReport } from "@/lib/report";

const nf = new Intl.NumberFormat("vi-VN");

const METHOD: Record<string, string> = {
  exact: "khớp chính xác",
  alias: "theo tên biệt dược",
  vector: "tên gần đúng",
};

/** What was checked to reach the verdict, in numbers a non-specialist can follow. Counts come from the server. */
export function TrustPanel({ report }: { report: InteractionReport }) {
  const a = report.audit;
  if (!a) return null;
  const dropped = Math.max(0, a.claims_written - a.claims_kept);
  const docs = a.ddinter_pages + a.fda_labels;
  const kept = a.claims_written ? Math.round((a.claims_kept / a.claims_written) * 100) : 100;

  const steps = [
    {
      icon: ScanSearch,
      title: "Nhận diện hoạt chất",
      big: `${a.drugs_matched}/${a.drugs_total}`,
      unit: "thuốc",
      body: (
        <span className="flex flex-wrap gap-1">
          {report.drugs.map((d) => (
            <span key={d.input} className={d.dbName ? "rounded-md bg-card px-1.5 py-0.5" : "rounded-md border border-dashed px-1.5 py-0.5"}>
              {d.dbName && d.input.toLowerCase() !== d.dbName.toLowerCase() ? `${d.input} → ${d.dbName}` : d.dbName ?? `${d.input} (chưa nhận ra)`}
              {d.dbName && METHOD[d.method] && <span className="text-muted-foreground"> · {METHOD[d.method]}</span>}
            </span>
          ))}
        </span>
      ),
    },
    {
      icon: Database,
      title: "Đối chiếu cơ sở dữ liệu",
      big: nf.format(a.db_interactions),
      unit: "cặp tương tác",
      body: (
        <>
          của {nf.format(a.db_drugs)} hoạt chất trong{" "}
          <a href="https://ddinter2.scbdd.com/" target="_blank" rel="noopener noreferrer" className="font-semibold underline">
            DDInter 2.0
          </a>
          ; đã tra {a.pairs_checked} cặp thuốc của bạn.
        </>
      ),
    },
    {
      icon: FileText,
      title: "Đọc tài liệu gốc",
      big: String(docs),
      unit: "tài liệu",
      body: `${a.fda_labels} nhãn thuốc chính thức của FDA Hoa Kỳ (DailyMed) và ${a.ddinter_pages} trang chuyên khảo DDInter về đúng cặp thuốc này.`,
    },
    {
      icon: BadgeCheck,
      title: "Kiểm chứng từng câu",
      big: `${a.claims_kept}`,
      unit: "ý có dẫn nguồn",
      body: (
        <span className="flex flex-col gap-1.5">
          <span>
            Mỗi ý AI viết phải trích nguồn ở trên.{" "}
            {dropped > 0 ? `${dropped} ý thiếu nguồn đã bị hệ thống tự động loại bỏ.` : "Không có ý nào thiếu nguồn."}
          </span>
          <span className="h-1.5 overflow-hidden rounded-full bg-card" aria-hidden="true">
            <span className="block h-full rounded-full bg-brand-ink" style={{ width: `${kept}%` }} />
          </span>
        </span>
      ),
    },
  ];

  return (
    <section aria-labelledby="trust-title" className="flex flex-col gap-3 rounded-2xl border border-brand-ink/20 bg-brand-soft/40 px-5 py-4 sm:px-6">
      <div className="flex flex-col gap-0.5">
        <h2 id="trust-title" className="text-[17px] font-bold text-brand-ink">
          Vì sao bạn có thể tin kết quả này
        </h2>
        <p className="text-sm text-neutral-ink">Mức độ nguy hiểm lấy từ cơ sở dữ liệu khoa học, không do AI tự đoán. AI chỉ diễn giải, và mọi câu đều kèm nguồn bấm được.</p>
      </div>
      <ol className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {steps.map((s, i) => (
          <li key={s.title} className="flex flex-col gap-1.5 rounded-xl bg-card/80 px-3.5 py-3">
            <span className="flex items-center gap-2 text-[13px] font-bold text-brand-ink">
              <span className="flex size-6 items-center justify-center rounded-full bg-brand-ink text-[11px] text-white">{i + 1}</span>
              <s.icon className="size-4" aria-hidden="true" />
              {s.title}
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-2xl leading-none font-bold tabular-nums">{s.big}</span>
              <span className="text-sm font-semibold text-neutral-ink">{s.unit}</span>
            </span>
            <span className="text-[13px] leading-snug text-neutral-ink">{s.body}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
