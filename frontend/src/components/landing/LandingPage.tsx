import { useState, type FormEvent, type ReactNode } from "react";
import { ArrowDown, ArrowRight, Camera, MessageCircleQuestion, Plus, Tag, Archive, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_DRUGS } from "@/components/check/DrugComposer";
import { DemoStage } from "./DemoStage";
import { DrugPhotoMock } from "./DrugPhotoMock";

interface LandingPageProps {
  /** Opens the check page with these drugs (checked right away when there are at least 2). */
  onStart: (drugs: string[]) => void;
  onOpenCheck: () => void;
  /** Header slot: sign-in button or the signed-in user. */
  account: ReactNode;
  logo: ReactNode;
}

const SEVERITY_ROWS = [
  { label: "Nghiêm trọng", ink: "text-sev-major-ink", stroke: "var(--color-sev-major)", width: 10, dashed: false, text: "Tránh dùng chung. Hỏi bác sĩ hoặc dược sĩ trước liều tiếp theo." },
  { label: "Trung bình", ink: "text-sev-moderate-ink", stroke: "var(--color-sev-moderate)", width: 7, dashed: false, text: "Có thể vẫn dùng, nhưng cần chỉnh liều hoặc theo dõi dấu hiệu." },
  { label: "Nhẹ", ink: "text-sev-minor", stroke: "var(--color-sev-minor)", width: 4, dashed: false, text: "Ít ảnh hưởng. Biết để báo khi đi khám." },
  { label: "Chưa có dữ liệu", ink: "text-neutral-ink", stroke: "var(--color-neutral-stroke)", width: 3, dashed: true, text: "" },
];

const FAQ = [
  {
    q: "Dữ liệu tương tác lấy từ đâu?",
    a: "Từ [NGUỒN DỮ LIỆU TƯƠNG TÁC]. AI chỉ diễn giải những gì có trong dữ liệu, và mỗi thuốc có liên kết tham khảo (ưu tiên Nhà thuốc Long Châu, sau đó Drugs.com) để bạn tự đối chiếu.",
  },
  { q: "“Chưa có dữ liệu” có nghĩa là an toàn?", a: "Không. Nó chỉ có nghĩa là cơ sở dữ liệu chưa ghi nhận cặp đó. Hãy hỏi dược sĩ nếu bạn còn lo lắng." },
  { q: "Tôi có cần tạo tài khoản?", a: "Không cần để kiểm tra. Tài khoản chỉ dùng để lưu tủ thuốc và lịch sử kiểm tra." },
  { q: "Ảnh tôi tải lên được xử lý thế nào?", a: "[CHÍNH SÁCH LƯU TRỮ ẢNH — thời gian lưu, ai có quyền xem]." },
  {
    q: "AI có thể sai không?",
    a: "Có. AI có thể đọc nhầm tên thuốc hoặc diễn giải chưa chính xác. Luôn kiểm tra tên thuốc đã nhận diện và hỏi chuyên gia trước khi thay đổi cách dùng thuốc.",
  },
];

const H2 = "text-[clamp(28px,3.6vw,44px)] leading-[1.12] font-extrabold tracking-[-0.02em]";

function Pill({ className, left, right }: { className: string; left: string; right: string }) {
  return (
    <span
      className={cn("absolute rounded-full border", className)}
      style={{ background: `linear-gradient(90deg, ${left} 50%, ${right} 50%)` }}
    />
  );
}

export function LandingPage({ onStart, onOpenCheck, account, logo }: LandingPageProps) {
  const [text, setText] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const names = [...new Set(text.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean))].slice(0, MAX_DRUGS);
    if (names.length) onStart(names);
    else onOpenCheck();
  };

  return (
    <div className="overflow-x-clip">
      <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center gap-x-8 gap-y-3 px-4 py-3 sm:px-8">
          {logo}
          <span className="flex-1 lg:hidden" />
          <nav aria-label="Trang giới thiệu" className="hidden flex-1 flex-wrap gap-1 lg:flex">
            {[
              ["#how", "Cách hoạt động"],
              ["#read", "Đọc kết quả"],
              ["#faq", "Câu hỏi"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="flex min-h-11 items-center rounded-lg px-3 font-medium text-neutral-ink hover:bg-muted">
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {account}
            <button type="button" onClick={onOpenCheck} className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary/90">
              Kiểm tra ngay
            </button>
          </div>
        </div>
      </header>

      {/* Hero: pills in three depth layers drift away at different speeds. */}
      <section aria-labelledby="hero-title" className="lp-hero relative flex min-h-[820px] items-center overflow-hidden border-b bg-card">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <span className="lp-px lp-px-slow absolute top-[10%] -left-[4%] size-[360px] rounded-full bg-brand-soft" />
          <span className="lp-px lp-px-slow absolute -right-[6%] -bottom-[8%] size-[460px] rounded-full bg-[#EEF5F5]" />
          <Pill className="lp-px lp-px-mid top-[58%] left-[7%] h-[66px] w-[190px] -rotate-[24deg] border-input shadow-[0_14px_26px_rgba(15,26,36,0.12)]" left="#0E5E63" right="#FFFFFF" />
          <span className="lp-px lp-px-mid absolute top-[14%] right-[9%] flex size-24 items-center justify-center rounded-full border border-input bg-card shadow-[0_12px_22px_rgba(15,26,36,0.1)]">
            <span className="h-[3px] w-[60%] rounded-sm bg-[#D9DEE3]" />
          </span>
          <Pill className="lp-px lp-px-fast top-[14%] left-[20%] h-[38px] w-[104px] rotate-[18deg] border-[#E3C08A] shadow-[0_10px_18px_rgba(15,26,36,0.14)]" left="#F2A33A" right="#FFFFFF" />
          <Pill className="lp-px lp-px-fast top-[66%] right-[18%] h-[46px] w-[132px] -rotate-[12deg] border-[#E3B3AE] shadow-[0_12px_22px_rgba(15,26,36,0.16)]" left="#B42318" right="#FFFFFF" />
          <span className="lp-px lp-px-up absolute bottom-[7%] left-[30%] size-[54px] rounded-full border border-input bg-card shadow-[0_8px_16px_rgba(15,26,36,0.1)]" />
          <span className="lp-px lp-px-up absolute top-[8%] right-[30%] size-[38px] rounded-full bg-sev-minor/85" />
        </div>

        <div className="lp-hero-copy relative mx-auto flex max-w-[980px] flex-col items-center gap-6 px-4 py-24 text-center sm:px-8">
          <span className="rounded-full bg-brand-soft px-3 py-1.5 text-sm font-semibold text-brand-ink">Kiểm tra tương tác thuốc bằng AI</span>
          <h1 id="hero-title" className="text-[clamp(40px,7vw,84px)] leading-[1.04] font-extrabold tracking-[-0.03em]">
            Các thuốc có tương tác lẫn nhau không?
          </h1>
          <p className="max-w-[36em] text-[clamp(17px,1.7vw,20px)] text-neutral-ink">
            Nhập tên thuốc hoặc chụp hộp thuốc. DDISafe tra từng cặp, vẽ sơ đồ mức độ nguy hiểm và nói rõ bạn nên làm gì tiếp theo.
          </p>
          <form onSubmit={submit} className="flex w-full max-w-[600px] flex-col gap-2 text-left">
            <label htmlFor="landing-drugs" className="text-sm font-semibold">
              Thuốc bạn đang dùng
            </label>
            <div className="flex flex-wrap gap-2 rounded-2xl border border-input bg-card p-1.5 shadow-[0_18px_40px_rgba(15,26,36,0.08)] focus-within:border-primary">
              <input
                id="landing-drugs"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="VD: Coumadin, Advil, Panadol"
                className="h-13 min-w-0 flex-[1_1_220px] rounded-[10px] bg-transparent px-3.5 outline-none"
              />
              <button type="submit" className="flex h-13 flex-none items-center gap-2 rounded-xl bg-primary px-5.5 font-bold text-primary-foreground hover:bg-primary/90">
                Kiểm tra
                <ArrowRight className="size-[18px]" strokeWidth={2.2} aria-hidden="true" />
              </button>
            </div>
          </form>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <button type="button" onClick={onOpenCheck} className="flex min-h-11 items-center gap-1.5 font-semibold text-primary hover:underline">
              <Camera className="size-[18px]" aria-hidden="true" />
              Chụp ảnh hộp thuốc
            </button>
            <span className="flex items-center">Không cần đăng nhập</span>
            <span className="flex items-center">Hiểu cả tên biệt dược</span>
          </div>
          <a href="#how" className="mt-3 flex min-h-11 flex-col items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground">
            Cuộn để xem cách hoạt động
            <ArrowDown className="size-5" aria-hidden="true" />
          </a>
        </div>
      </section>

      {/* Story: steps scroll on the left while the map builds itself in a pinned stage. */}
      <section
        id="how"
        aria-labelledby="how-title"
        className="lp-story mx-auto flex max-w-[1200px] scroll-mt-16 flex-wrap items-start gap-x-14 gap-y-8 px-4 py-[clamp(56px,7vw,96px)] sm:px-8"
      >
        <div className="flex min-w-0 flex-[1_1_380px] flex-col">
          <h2 id="how-title" className={cn(H2, "mb-2")}>
            Ba bước, khoảng một phút
          </h2>
          <p className="text-[17px] text-neutral-ink">Cuộn xuống để xem sơ đồ được dựng lên từng bước.</p>

          <Step n={1} title="Thêm thuốc, hoặc chỉ cần chụp ảnh">
            <p>Gõ tên, dán cả danh sách, hoặc chụp hộp thuốc và đơn thuốc. Tên biệt dược được tự đổi sang hoạt chất.</p>
            <DrugPhotoMock className="lp-reveal max-w-[440px]" />
          </Step>
          <Step n={2} title="AI tra từng cặp thuốc">
            <p>Mỗi cặp được tra trong cơ sở dữ liệu tương tác. Đường nối càng đậm, tương tác càng nặng.</p>
            <ul className="lp-reveal flex max-w-[360px] flex-col gap-2.5 rounded-[14px] border bg-card p-4 text-[15px] text-foreground">
              {["Nhận diện 3 thuốc", "Tra 3 cặp thuốc"].map((s) => (
                <li key={s} className="flex items-center gap-2.5">
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary">
                    <Check className="size-3 text-primary-foreground" strokeWidth={3} aria-hidden="true" />
                  </span>
                  {s}
                </li>
              ))}
              <li className="flex items-center gap-2.5 font-semibold">
                <span className="size-5 animate-spin rounded-full border-[2.5px] border-primary border-r-input" aria-hidden="true" />
                Tìm nguồn tham khảo
              </li>
            </ul>
          </Step>
          <Step n={3} title="Biết mức rủi ro và nên làm gì">
            <p>Mức rủi ro chung, giải thích từng cặp, việc nên làm và nguồn để đối chiếu. Bấm vào nhãn trên sơ đồ để xem chi tiết, hoặc đổi ví dụ.</p>
          </Step>
        </div>

        <div className="min-w-0 flex-[1_1_420px] lg:sticky lg:top-24">
          <DemoStage />
        </div>
      </section>

      {/* Severity lines grow in as each row enters. */}
      <section id="read" aria-labelledby="read-title" className="scroll-mt-16 border-y bg-card">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-10 px-4 py-[clamp(56px,8vw,112px)] sm:px-8">
          <div className="lp-reveal flex max-w-[680px] flex-col gap-3">
            <h2 id="read-title" className={H2}>
              Đọc kết quả trong vài giây
            </h2>
            <p className="text-[17px] text-neutral-ink">Mỗi mức độ có độ đậm nét riêng và luôn đi kèm chữ, không chỉ dựa vào màu.</p>
          </div>
          <ul className="flex flex-col border-b">
            {SEVERITY_ROWS.map((r) => (
              <li key={r.label} className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t py-6">
                <span className={cn("flex-[0_0_160px] text-xl font-extrabold", r.ink)}>{r.label}</span>
                <svg className="lp-grow min-w-[120px] flex-[1_1_200px]" height="14" viewBox="0 0 400 14" preserveAspectRatio="none" aria-hidden="true">
                  <line
                    x1="7"
                    y1="7"
                    x2="393"
                    y2="7"
                    stroke={r.stroke}
                    strokeWidth={r.width}
                    strokeDasharray={r.dashed ? "10 10" : undefined}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="min-w-0 flex-[1_1_300px] text-neutral-ink">
                  {r.text || (
                    <>
                      <strong className="text-foreground">Không có nghĩa là an toàn.</strong> Chỉ là chưa có ghi nhận.
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Features: two columns drifting at different speeds. */}
      <section aria-labelledby="feat-title" className="mx-auto flex max-w-[1200px] flex-wrap items-start gap-x-12 gap-y-8 px-4 py-[clamp(56px,8vw,120px)] sm:px-8">
        <div className="lp-reveal flex min-w-0 flex-[1_1_300px] flex-col gap-3">
          <h2 id="feat-title" className={H2}>
            Làm được nhiều hơn một lần tra cứu
          </h2>
          <p className="text-[17px] text-neutral-ink">Lưu thuốc đang dùng, hỏi thêm, và mang kết quả theo khi đi khám.</p>
        </div>
        <div className="flex min-w-0 flex-[2_1_520px] flex-wrap gap-5">
          <div className="lp-col-a flex min-w-0 flex-[1_1_250px] flex-col gap-5">
            <Feature icon={<Camera />} title="Chụp là đọc" text="Chụp hộp thuốc hoặc đơn thuốc, AI đọc tên giúp bạn. Sửa lại nếu đọc sai." />
            <Feature icon={<Archive />} title="Tủ thuốc cá nhân" text="Lưu thuốc đang dùng. Thêm thuốc mới là biết ngay nó có đụng thuốc cũ không." />
          </div>
          <div className="lp-col-b flex min-w-0 flex-[1_1_250px] flex-col gap-5 lg:mt-24">
            <Feature icon={<Tag />} title="Hiểu tên biệt dược" text="Panadol thành Acetaminophen, Coumadin thành Warfarin. Bạn luôn thấy mình đã nhập gì." />
            <Feature
              dark
              icon={<MessageCircleQuestion />}
              title="Hỏi thêm về kết quả"
              text="“Tôi nên uống cách nhau bao lâu?” Hỏi ngay dưới kết quả, AI trả lời dựa trên đúng các thuốc đó."
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="limit-title" className="mx-auto max-w-[1200px] px-4 pb-[clamp(56px,8vw,112px)] sm:px-8">
        <div className="lp-reveal flex flex-wrap gap-x-12 gap-y-8 rounded-3xl border bg-card p-[clamp(24px,4vw,48px)]">
          <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-2.5">
            <h2 id="limit-title" className="text-[clamp(24px,2.6vw,32px)] leading-tight font-extrabold tracking-[-0.02em]">
              Một công cụ để hỏi đúng câu, không phải đơn thuốc
            </h2>
            <p className="text-neutral-ink">Quyết định dùng thuốc vẫn thuộc về bác sĩ và dược sĩ của bạn.</p>
          </div>
          <LimitList title="DDISafe giúp bạn" good items={["Biết cặp thuốc nào cần chú ý", "Chuẩn bị câu hỏi trước khi đi khám", "In kết quả mang theo cho bác sĩ"]} />
          <LimitList title="DDISafe không thay thế" items={["Chẩn đoán hay kê đơn", "Tự ý ngừng hoặc đổi thuốc", "Cấp cứu: gọi 115 ngay"]} />
        </div>
      </section>

      <section id="faq" aria-labelledby="faq-title" className="scroll-mt-16 border-t bg-card">
        <div className="mx-auto flex max-w-[820px] flex-col gap-6 px-4 py-[clamp(56px,8vw,112px)] sm:px-8">
          <h2 id="faq-title" className={cn(H2, "lp-reveal")}>
            Câu hỏi thường gặp
          </h2>
          <div className="flex flex-col border-t">
            {FAQ.map((f, i) => (
              <details key={f.q} open={i === 0} className="group border-b">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-semibold [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <Plus className="size-5 flex-none text-primary transition-transform group-open:rotate-45" aria-hidden="true" />
                </summary>
                <p className="mb-5 text-neutral-ink">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA: pills slide past in opposite directions. */}
      <section aria-labelledby="cta-title" className="relative overflow-hidden bg-primary text-primary-foreground">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <Pill className="lp-cta-l top-[14%] left-[4%] h-[72px] w-[220px] -rotate-[10deg] border-transparent" left="#0B4C50" right="#1A7479" />
          <Pill className="lp-cta-r right-[6%] bottom-[12%] h-14 w-40 rotate-[14deg] border-transparent" left="#1A7479" right="#0B4C50" />
          <span className="lp-cta-r absolute -bottom-[30px] left-[38%] size-[90px] rounded-full bg-brand-ink" />
        </div>
        <div className="lp-reveal relative mx-auto flex max-w-[760px] flex-col items-center gap-5 px-4 py-[clamp(72px,10vw,140px)] text-center sm:px-8">
          <h2 id="cta-title" className="text-[clamp(32px,5vw,60px)] leading-[1.08] font-extrabold tracking-[-0.025em]">
            Kiểm tra trước khi uống
          </h2>
          <p className="text-lg text-[#D3E7E7]">Mất khoảng một phút, và bạn sẽ biết cần hỏi bác sĩ điều gì.</p>
          <button
            type="button"
            onClick={onOpenCheck}
            className="flex h-14 items-center gap-2 rounded-[14px] bg-card px-7 text-[17px] font-bold text-brand-ink hover:bg-brand-soft"
          >
            Bắt đầu kiểm tra
            <ArrowRight className="size-[18px]" strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col justify-center gap-4 py-12 text-[17px] text-neutral-ink lg:min-h-[620px]">
      <span className="text-sm font-bold text-primary">Bước {n}</span>
      <h3 className="text-[clamp(22px,2.4vw,30px)] font-extrabold tracking-[-0.01em] text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Feature({ icon, title, text, dark }: { icon: ReactNode; title: string; text: string; dark?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-2.5 rounded-[20px] p-7", dark ? "bg-primary text-primary-foreground" : "border bg-card")}>
      <span
        className={cn(
          "flex size-11 items-center justify-center rounded-xl [&_svg]:size-[22px]",
          dark ? "bg-brand-ink text-primary-foreground" : "bg-brand-soft text-primary",
        )}
        aria-hidden="true"
      >
        {icon}
      </span>
      <h3 className="text-[19px] font-bold">{title}</h3>
      <p className={dark ? "text-[#D3E7E7]" : "text-neutral-ink"}>{text}</p>
    </div>
  );
}

function LimitList({ title, items, good }: { title: string; items: string[]; good?: boolean }) {
  const Icon = good ? Check : X;
  return (
    <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-3">
      <h3 className={cn("font-bold", good ? "text-brand-ink" : "text-sev-major-ink")}>{title}</h3>
      <ul className="flex flex-col gap-2.5 text-neutral-ink">
        {items.map((it) => (
          <li key={it} className="flex gap-2.5">
            <Icon className={cn("mt-0.5 size-[18px] flex-none", good ? "text-primary" : "text-sev-major")} strokeWidth={2.4} aria-hidden="true" />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
