import { Activity, AlertTriangle, ArrowDown, ArrowRight, Clock, FlaskConical, Pill, Sparkles, Stethoscope, Target, Users } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { KIND_META, MECHANISM_LABEL, type DrugProfile, type PairAnalysis, type PairKind } from "@/lib/report";

const COMBINED = /dùng chung|kết hợp|phối hợp/i;

/** Shows that the pharmacology below is AI interpretation, not database content. */
export function AiTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-neutral-ink">
      <Sparkles className="size-3" aria-hidden="true" />
      AI tổng hợp
    </span>
  );
}

/** Drug A does X, drug B does Y, together they cause Z: the mechanism as a flow the eye can follow. */
function MechanismChain({ chain, kind }: { chain: PairAnalysis["chain"]; kind: PairKind }) {
  const meta = KIND_META[kind];
  return (
    <ol className="flex flex-col items-stretch gap-1.5 sm:flex-row sm:items-stretch">
      {chain.map((step, i) => {
        const result = i === chain.length - 1 && (COMBINED.test(step.actor) || chain.length > 2);
        return (
          <li key={i} className="flex flex-col items-center gap-1.5 sm:flex-1 sm:flex-row">
            <div
              className={cn(
                "flex w-full flex-1 flex-col gap-1 self-stretch rounded-xl border px-3.5 py-3",
                result ? meta.soft : "bg-card",
              )}
            >
              <span className={cn("text-xs font-bold tracking-wide uppercase", result ? "" : "text-brand-ink")}>
                {result ? <AlertTriangle className="mr-1 inline size-3.5 align-[-2px]" aria-hidden="true" /> : <Pill className="mr-1 inline size-3.5 align-[-2px]" aria-hidden="true" />}
                {step.actor}
              </span>
              <span className={cn("text-sm leading-snug", result && "font-semibold")}>{step.effect}</span>
            </div>
            {i < chain.length - 1 && (
              <>
                <ArrowDown className="size-4 shrink-0 text-neutral-ink sm:hidden" aria-hidden="true" />
                <ArrowRight className="hidden size-4 shrink-0 text-neutral-ink sm:block" aria-hidden="true" />
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function FactList({ icon: Icon, title, items, tone }: { icon: typeof Activity; title: string; items: string[]; tone: string }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card px-3.5 py-3">
      <h5 className={cn("flex items-center gap-1.5 text-[13px] font-bold", tone)}>
        <Icon className="size-4" aria-hidden="true" />
        {title}
      </h5>
      <ul className="flex flex-col gap-1.5 text-sm leading-snug">
        {items.map((t) => (
          <li key={t} className="flex gap-2">
            <span className={cn("mt-[7px] size-1.5 shrink-0 rounded-full bg-current", tone)} aria-hidden="true" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Why the pair is harmful: mechanism flow, the detailed reason, consequences, who is at risk and what to watch. */
export function PairAnalysisView({ analysis, kind }: { analysis: PairAnalysis; kind: PairKind }) {
  const mech = MECHANISM_LABEL[analysis.mechanism_type];
  return (
    <section className="flex flex-col gap-3.5" aria-label="Vì sao cặp thuốc này có hại">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-[15px] font-bold">Vì sao dùng chung lại có hại?</h4>
        <span title={mech.hint} className="rounded-full border border-brand-ink/30 bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand-ink">
          Cơ chế: {mech.label}
        </span>
        <AiTag />
      </div>

      {analysis.chain.length >= 2 && <MechanismChain chain={analysis.chain} kind={kind} />}

      <p className="max-w-[78ch] leading-relaxed whitespace-pre-line">{analysis.why_harmful}</p>

      {analysis.onset && (
        <p className="flex items-start gap-2 text-sm text-neutral-ink">
          <Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold">Thời điểm xuất hiện: </span>
            {analysis.onset}
          </span>
        </p>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-2.5">
        <FactList icon={AlertTriangle} title="Hậu quả có thể gặp" items={analysis.consequences} tone="text-sev-major-ink" />
        <FactList icon={Users} title="Ai dễ gặp nguy cơ hơn" items={analysis.risk_factors} tone="text-sev-moderate-ink" />
        <FactList icon={Activity} title="Cần theo dõi" items={analysis.monitoring} tone="text-brand-ink" />
      </div>
    </section>
  );
}

function ProfileRow({ icon: Icon, label, children }: { icon: typeof Activity; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-brand-ink" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs font-bold tracking-wide text-neutral-ink uppercase">{label}</span>
        <div className="text-sm leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <span className="mt-0.5 flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span key={t} className="rounded-md bg-muted px-2 py-0.5 text-[13px]">
          {t}
        </span>
      ))}
    </span>
  );
}

/** Pharmacology card for one active ingredient. */
export function DrugProfileCard({ profile }: { profile: DrugProfile }) {
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card px-4 py-3.5">
      <header className="flex flex-col gap-1">
        <h5 className="text-lg leading-tight font-bold">{profile.name}</h5>
        <span className="w-fit rounded-md bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand-ink">{profile.drug_class}</span>
      </header>
      <ProfileRow icon={Target} label="Cơ chế tác dụng">
        {profile.mechanism}
      </ProfileRow>
      {profile.indications.length > 0 && (
        <ProfileRow icon={Stethoscope} label="Chỉ định chính">
          <Chips items={profile.indications} />
        </ProfileRow>
      )}
      <ProfileRow icon={FlaskConical} label="Dược động học">
        {profile.pharmacokinetics}
      </ProfileRow>
      {profile.adverse_effects.length > 0 && (
        <ProfileRow icon={AlertTriangle} label="Tác dụng phụ đáng chú ý">
          <Chips items={profile.adverse_effects} />
        </ProfileRow>
      )}
      <p className="rounded-lg border-l-4 border-sev-major bg-sev-major-soft/60 px-3 py-2 text-sm leading-snug">
        <span className="font-bold text-sev-major-ink">Vai trò trong tương tác: </span>
        {profile.interaction_role}
      </p>
    </article>
  );
}

export function DrugProfiles({ profiles }: { profiles: DrugProfile[] }) {
  if (!profiles.length) return null;
  return (
    <section className="flex flex-col gap-2.5" aria-label="Thông tin dược học của từng hoạt chất">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-[15px] font-bold">Thông tin dược học từng hoạt chất</h4>
        <AiTag />
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-2.5">
        {profiles.map((p) => (
          <DrugProfileCard key={p.name} profile={p} />
        ))}
      </div>
    </section>
  );
}
