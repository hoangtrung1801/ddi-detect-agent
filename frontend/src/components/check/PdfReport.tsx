import { KIND_META, MECHANISM_LABEL, RISK_META, type DrugProfile, type InteractionReport } from "@/lib/report";
import { cn } from "@/lib/utils";
import { BodyMap } from "./BodyMap";
import { buildCiteIndex, Cite, CiteProvider, sourceHost, type CiteIndex } from "./Evidence";
import { SeverityGauge } from "./SeverityGauge";
import { headline } from "./Verdict";
import type { DisplayDrug, DisplayPair } from "./types";

export interface PdfReportProps {
  report: InteractionReport;
  pairs: DisplayPair[];
  drugs: DisplayDrug[];
  unresolved: string[];
  /** QR code image (data URL) per source id. */
  qr: Record<string, string>;
  generatedAt: Date;
}

/** Each block is kept whole on one PDF page where possible. */
const Block = ({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) => (
  <div data-pdf-block className={className} style={style}>
    {children}
  </div>
);

function profilesOf(p: DisplayPair, all: Record<string, DrugProfile>): DrugProfile[] {
  const names = p.ingredientPairs?.length ? p.ingredientPairs.flatMap((i) => [i.a, i.b]) : [p.a, p.b];
  return [...new Set(names)].map((n) => all[n]).filter((x): x is DrugProfile => !!x);
}

/** One numbering for the whole document, in reading order. */
function documentIndex(report: InteractionReport, pairs: DisplayPair[]): CiteIndex {
  const sources = report.sources ?? {};
  const order: string[] = [];
  const shown = new Set<string>();
  for (const p of pairs) {
    if (p.status !== "interaction") continue;
    const urls = new Set((p.sourceRecords ?? []).flatMap((r) => r.details ?? []).map((d) => d.url));
    const ddinter = Object.values(sources).filter((s) => s.kind === "ddinter" && urls.has(s.url)).map((s) => s.id);
    const profiles = profilesOf(p, report.drug_profiles ?? {}).filter((x) => !shown.has(x.name));
    profiles.forEach((x) => shown.add(x.name));
    for (const id of buildCiteIndex(sources, p.analysis, profiles, ddinter).order) if (!order.includes(id)) order.push(id);
  }
  return { order, sources };
}

/** A4-width (794 px) printable report, rendered off-screen and captured into the PDF. */
export function PdfReport({ report, pairs, drugs, unresolved, qr, generatedAt }: PdfReportProps) {
  const meta = RISK_META[report.overall_risk];
  const { title, sub } = headline(pairs, unresolved);
  const index = documentIndex(report, pairs);
  const profiles = report.drug_profiles ?? {};
  const printed = new Set<string>();

  return (
    <CiteProvider index={index}>
      <div className="flex w-[794px] flex-col gap-4 bg-white px-10 pt-2 pb-6 text-[13px] leading-relaxed text-[#0F1A24]">
        <Block className="flex items-end justify-between border-b-2 border-[#0B4C50] pb-3">
          <div>
            <div className="text-[22px] font-bold tracking-tight text-[#0B4C50]">DRUG-GUARD AI</div>
            <div className="text-[15px] font-semibold">Báo cáo kiểm tra tương tác thuốc</div>
          </div>
          <div className="text-right text-[12px] text-[#5B6670]">
            Tạo lúc {generatedAt.toLocaleString("vi-VN")}
            <br />
            Dữ liệu: DDInter 2.0 · Nhãn thuốc FDA (DailyMed)
          </div>
        </Block>

        <Block className={cn("flex items-center gap-5 rounded-xl border px-5 py-4", meta.panel)}>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className={cn("text-[12px] font-bold tracking-wider uppercase", meta.title)}>Kết luận · {meta.label}</div>
            <div className={cn("text-[20px] leading-tight font-bold", meta.title)}>{title}</div>
            <div className={meta.title}>{sub}</div>
          </div>
          <SeverityGauge risk={report.overall_risk} label={meta.label} />
        </Block>

        {(() => {
          const urgent = [...new Set(report.pairs.flatMap((p) => p.analysis?.consequences ?? []).filter((c) => c.urgent).map((c) => c.text))];
          return urgent.length ? (
            <Block className="rounded-xl px-4 py-3">
              <div style={{ border: "2px solid #B42318", background: "#FDECEA", borderRadius: 12, padding: "12px 16px", margin: "-12px -16px" }}>
              <div className="text-[14px] font-bold text-[#7A1A12]">Đi cấp cứu (115) hoặc gọi bác sĩ ngay nếu có:</div>
              <ul className="mt-1 flex flex-col gap-0.5 text-[#7A1A12]">
                {urgent.map((t) => (
                  <li key={t} className="flex gap-1.5">
                    <span className="shrink-0">–</span>
                    <span className="font-semibold">{t}</span>
                  </li>
                ))}
              </ul>
              </div>
            </Block>
          ) : null;
        })()}

        {report.audit && (
          <Block className="grid grid-cols-4 gap-2 rounded-xl px-4 py-3" style={{ background: "#E6F4F3" }}>
            {[
              [`${report.audit.drugs_matched}/${report.audit.drugs_total}`, "thuốc nhận diện được"],
              [new Intl.NumberFormat("vi-VN").format(report.audit.db_interactions), "cặp tương tác DDInter 2.0 đã đối chiếu"],
              [String(report.audit.fda_labels + report.audit.ddinter_pages), "tài liệu gốc (nhãn FDA, DDInter)"],
              [`${report.audit.claims_kept}`, `ý có dẫn nguồn${report.audit.claims_written > report.audit.claims_kept ? `; ${report.audit.claims_written - report.audit.claims_kept} ý thiếu nguồn đã bị loại` : ""}`],
            ].map(([n, l]) => (
              <div key={l} style={{ color: "#0B4C50" }}>
                <div className="text-[18px] font-bold">{n}</div>
                <div className="text-[11px] leading-snug">{l}</div>
              </div>
            ))}
          </Block>
        )}

        <Block className="flex flex-col gap-1.5">
          <div className="text-[14px] font-bold">Thuốc đã kiểm tra ({drugs.length})</div>
          <div className="flex flex-wrap gap-1.5">
            {drugs.map((d) => (
              <span key={d.label} className={cn("rounded-md border px-2 py-0.5", !d.resolved && "border-dashed text-[#5B6670]")}>
                {d.input !== d.label ? `${d.input} → ${d.label}` : d.label}
                {!d.resolved && " (chưa nhận ra)"}
              </span>
            ))}
          </div>
        </Block>

        {report.recommendations.length > 0 && (
          <Block className="flex flex-col gap-1.5">
            <div className="text-[14px] font-bold text-[#0B4C50]">Việc bạn nên làm</div>
            <ol className="flex flex-col gap-1">
              {report.recommendations.map((r, i) => (
                <li key={r} className="flex gap-2">
                  <span className="w-4 shrink-0 font-bold text-[#0B4C50]">{i + 1}.</span>
                  <span>{r}</span>
                </li>
              ))}
            </ol>
          </Block>
        )}

        <Block className="flex flex-col gap-1.5">
          <div className="text-[14px] font-bold">Tổng quan từng cặp ({pairs.length})</div>
          <table className="w-full border-collapse text-left">
            <tbody>
              {pairs.map((p) => (
                <tr key={p.id} className="border-b border-[#E3E7EA]">
                  <td className="py-1.5 pr-3 font-semibold">
                    {p.a} + {p.b}
                  </td>
                  <td className="py-1.5 pr-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", KIND_META[p.kind].badge)}>{KIND_META[p.kind].label}</span>
                  </td>
                  <td className="py-1.5">{KIND_META[p.kind].answer}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Block>

        {pairs
          .filter((p) => p.status === "interaction")
          .map((p) => {
            const a = p.analysis;
            const mgmt = [...new Set((p.sourceRecords ?? []).flatMap((r) => r.details ?? []).map((d) => d.management).filter((m): m is string => !!m))];
            const urls = new Set((p.sourceRecords ?? []).flatMap((r) => r.details ?? []).map((d) => d.url));
            const ddinter = Object.values(report.sources ?? {}).filter((s) => s.kind === "ddinter" && urls.has(s.url)).map((s) => s.id);
            const own = profilesOf(p, profiles).filter((x) => !printed.has(x.name));
            own.forEach((x) => printed.add(x.name));
            return (
              <section key={p.id} className="flex flex-col gap-2.5 border-t-2 border-[#E3E7EA] pt-3">
                <Block className="flex flex-col gap-1">
                  <div className="flex items-center gap-2.5">
                    <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold", KIND_META[p.kind].badge)}>{KIND_META[p.kind].label}</span>
                    <span className="text-[17px] font-bold">
                      {p.a} + {p.b}
                    </span>
                    {a && <span className="text-[12px] text-[#5B6670]">Cơ chế: {MECHANISM_LABEL[a.mechanism_type].label}</span>}
                  </div>
                  <div className="font-semibold">{p.explanation}</div>
                </Block>
                {a && a.chain.length >= 2 && (
                  <Block className="flex items-stretch gap-1.5">
                    {a.chain.map((c, i) => (
                      <div key={i} className={cn("flex-1 rounded-lg border px-2.5 py-2", i === a.chain.length - 1 && KIND_META[p.kind].soft)}>
                        <div className="text-[11px] font-bold uppercase">{c.actor}</div>
                        <div className="text-[12px] leading-snug">
                          {c.effect}
                          <Cite ids={c.sources} />
                        </div>
                      </div>
                    ))}
                  </Block>
                )}
                {a &&
                  a.why_harmful
                    .split(/\n\s*\n/)
                    .filter((x) => x.trim())
                    .map((para, i, all) => (
                      <Block key={i}>
                        {i === 0 && <div className="mb-0.5 text-[14px] font-bold">Vì sao dùng chung lại có hại?</div>}
                        <p>
                          {para.trim()}
                          {i === all.length - 1 && <Cite ids={a.why_harmful_sources} />}
                        </p>
                      </Block>
                    ))}
                {a && a.consequences.length > 0 && (
                  <Block className="flex flex-col gap-1">
                    <div className="text-[14px] font-bold text-[#7A1A12]">Hậu quả có thể gặp, theo cơ quan</div>
                    <BodyMap consequences={a.consequences} severe={p.kind === "major"} animate={false} />
                  </Block>
                )}
                {a && (a.risk_factors.length > 0 || a.monitoring.length > 0 || a.onset) && (
                  <Block className="grid grid-cols-2 gap-3">
                    {[
                      ["Ai dễ gặp nguy cơ hơn", a.risk_factors],
                      ["Cần theo dõi", a.monitoring],
                    ].map(([h, items]) => (
                      <div key={h as string} className="rounded-lg border px-3 py-2">
                        <div className="font-bold">{h as string}</div>
                        <ul className="flex flex-col gap-0.5">
                          {(items as { text: string; sources: string[] }[]).map((x) => (
                            <li key={x.text} className="flex gap-1.5">
                              <span className="shrink-0">–</span>
                              <span>
                              {x.text}
                              <Cite ids={x.sources} />
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    {a.onset && (
                      <div className="col-span-2">
                        <span className="font-bold">Thời điểm xuất hiện: </span>
                        {a.onset.text}
                        <Cite ids={a.onset.sources} />
                      </div>
                    )}
                  </Block>
                )}
                {mgmt.length > 0 && (
                  <Block className="rounded-lg bg-[#E6F4F3] px-3 py-2">
                    <div className="font-bold text-[#0B4C50]">Hướng xử trí theo DDInter (không phải chỉ định cá nhân)</div>
                    <p>
                      {a?.management_vi ?? mgmt.join(" ")}
                      <Cite ids={ddinter} />
                    </p>
                  </Block>
                )}
                {own.length > 0 && (
                  <Block className="text-[14px] font-bold">Thông tin dược học từng hoạt chất</Block>
                )}
                {own.map((d) => (
                  <Block key={d.name} className="flex flex-col gap-1 rounded-lg border px-3 py-2">
                    <div>
                      <span className="text-[15px] font-bold">{d.name}</span> <span className="text-[#0B4C50]">· {d.drug_class}</span>
                    </div>
                    <div>
                      <b>Cơ chế tác dụng: </b>
                      {d.mechanism.text}
                      <Cite ids={d.mechanism.sources} />
                    </div>
                    {d.indications.length > 0 && (
                      <div>
                        <b>Chỉ định chính: </b>
                        {d.indications.map((x, i) => (
                          <span key={x.text}>
                            {i > 0 && "; "}
                            {x.text}
                            <Cite ids={x.sources} />
                          </span>
                        ))}
                      </div>
                    )}
                    {d.pharmacokinetics && (
                      <div>
                        <b>Dược động học: </b>
                        {d.pharmacokinetics.text}
                        <Cite ids={d.pharmacokinetics.sources} />
                      </div>
                    )}
                    {d.adverse_effects.length > 0 && (
                      <div>
                        <b>Tác dụng phụ đáng chú ý: </b>
                        {d.adverse_effects.map((x, i) => (
                          <span key={x.text}>
                            {i > 0 && "; "}
                            {x.text}
                            <Cite ids={x.sources} />
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="text-[#7A1A12]">
                      <b>Vai trò trong tương tác: </b>
                      {d.interaction_role.text}
                      <Cite ids={d.interaction_role.sources} />
                    </div>
                  </Block>
                ))}
              </section>
            );
          })}

        {index.order.length > 0 && (
          <>
            <Block className="border-t-2 border-[#E3E7EA] pt-3 text-[15px] font-bold">
              Nguồn tham khảo ({index.order.length}) · quét mã QR hoặc bấm liên kết để mở
            </Block>
            {index.order.map((id, i) => {
              const s = index.sources[id]!;
              return (
                <Block key={id} className="flex items-start gap-3">
                  <span className="flex size-[22px] shrink-0 items-center justify-center rounded-md bg-[#E6F4F3] text-[12px] font-bold text-[#0B4C50]">{i + 1}</span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold">{s.title}</span>
                    <span className="text-[11px] text-[#5B6670]">
                      {s.publisher} · {sourceHost(s.url)}
                      {s.link === "search" && " · trích dẫn không có PMID/DOI, liên kết tìm trên PubMed"}
                    </span>
                    <span data-pdf-link={s.url} className="text-[11px] break-all text-[#0B5CAD] underline">
                      {s.url}
                    </span>
                  </div>
                  {qr[id] && <img src={qr[id]} alt="" width={64} height={64} className="shrink-0" />}
                </Block>
              );
            })}
          </>
        )}

        <Block className="border-t border-[#E3E7EA] pt-2 text-[11px] text-[#5B6670]">
          {report.disclaimer} Phần giải thích bằng tiếng Việt do AI tổng hợp từ các nguồn được đánh số; mỗi ý đều ghi số nguồn để đối chiếu.
        </Block>
      </div>
    </CiteProvider>
  );
}
