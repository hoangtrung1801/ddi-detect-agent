import { useEffect, useRef, useState, type FormEvent } from "react";
import { RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ResolvedDrug } from "@/lib/report";
import { DrugSearch } from "./DrugSearch";
import { PRODUCT_TAG, productKind } from "./CheckStart";
import { photoReading } from "./SourcePhotos";
import { MAX_DRUGS, type DrugEntry, type PhotoEntry } from "./types";

const norm = (s: string) => s.trim().toLowerCase();

/** The resolution of an entry, and whether the user should fix it (unrecognised drug or ingredient). */
export function resolutionOf(d: DrugEntry, resolved: ResolvedDrug[]) {
  const r = resolved.find((x) => norm(x.input) === norm(d.name));
  const missingIngredients = r?.ingredients?.filter((i) => !i.dbName).map((i) => i.input) ?? [];
  return { r, unknown: !!r && !r.dbName, missingIngredients, needsFix: !!r && (!r.dbName || missingIngredients.length > 0) };
}

interface DrugBarProps {
  drugs: DrugEntry[];
  resolved: ResolvedDrug[];
  running: boolean;
  /** The list changed since the shown result was made. */
  stale: boolean;
  fixId: string | null;
  /** Photos the drugs were read from; a chip shows its photo so the user can check it. */
  photos: PhotoEntry[];
  onViewPhoto: (id: string) => void;
  onFix: (id: string | null) => void;
  onApplyFix: (id: string, names: string[]) => void;
  onAddDrug: (name: string) => void;
  onRemoveDrug: (id: string) => void;
  onRerun: () => void;
  onNewCheck: () => void;
}

/** The drugs being checked, as one compact bar above the result. */
export function DrugBar({ drugs, resolved, running, stale, fixId, photos, onViewPhoto, onFix, onApplyFix, onAddDrug, onRemoveDrug, onRerun, onNewCheck }: DrugBarProps) {
  const fixing = drugs.find((d) => d.id === fixId);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (fixing) ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [fixing]);

  return (
    <section ref={ref} aria-labelledby="drugbar-title" className="flex scroll-mt-4 flex-col gap-3 rounded-2xl border bg-card px-4 py-4 sm:px-5 print:hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="drugbar-title" className="text-[15px] font-bold">
          {running ? "Đang kiểm tra" : "Đã kiểm tra"} {drugs.length} sản phẩm
        </h2>
        <button type="button" onClick={onNewCheck} className="text-sm font-semibold text-primary hover:underline">
          Kiểm tra danh sách khác
        </button>
      </div>

      <ul className="flex flex-wrap items-center gap-2">
        {drugs.map((d) => {
          const { r, unknown, missingIngredients, needsFix } = resolutionOf(d, resolved);
          const kind = productKind(d);
          const photo = d.source ? photos.find((p) => p.file.name === d.source) : undefined;
          const renamed = r?.dbName && !d.ingredients?.length && norm(r.dbName) !== norm(d.name);
          const note = unknown
            ? "Chưa nhận ra"
            : missingIngredients.length && r?.ingredients
              ? `Nhận ra ${r.ingredients.length - missingIngredients.length}/${r.ingredients.length} thành phần`
              : renamed
                ? `từ “${d.name}”`
                : kind !== "drug"
                  ? `${PRODUCT_TAG[kind].label} · ${d.ingredients?.length ?? 0} thành phần`
                  : d.source
                    ? "từ ảnh hộp thuốc"
                    : null;
          return (
            <li
              key={d.id}
              className={cn(
                "flex min-h-11 items-center gap-1.5 rounded-xl py-1 pr-1",
                photo ? "pl-1" : "pl-3.5",
                needsFix ? "border-[1.5px] border-dashed border-neutral-stroke bg-muted/40" : "border bg-muted/50",
              )}
            >
              {photo && (
                <button
                  type="button"
                  onClick={() => onViewPhoto(photo.id)}
                  aria-label={`Xem ảnh gốc của ${d.name}`}
                  title={`Ảnh gốc · đọc được: ${photoReading(photo)}`}
                  className="mr-1 shrink-0 overflow-hidden rounded-lg border hover:ring-2 hover:ring-primary"
                >
                  <img src={photo.preview} alt="" className="size-9 object-cover" />
                </button>
              )}
              <span className="flex flex-col leading-tight">
                <span className="font-bold">{renamed ? r!.dbName : d.name}</span>
                {note && <span className="text-xs text-muted-foreground">{note}</span>}
              </span>
              {needsFix && !running && (
                <button
                  type="button"
                  onClick={() => onFix(fixId === d.id ? null : d.id)}
                  aria-expanded={fixId === d.id}
                  className="ml-1 h-9 rounded-lg bg-foreground px-3 text-[13px] font-semibold text-background"
                >
                  Sửa
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemoveDrug(d.id)}
                disabled={running}
                aria-label={`Bỏ ${d.name}`}
                className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </li>
          );
        })}
        {!running && drugs.length < MAX_DRUGS && (
          <li className="min-w-[220px] flex-[1_1_260px]">
            <DrugSearch onAdd={onAddDrug} placeholder="Thêm thuốc khác…" inputClassName="h-11 rounded-xl border text-[15px] pl-11" />
          </li>
        )}
      </ul>

      {fixing && !running && <FixPanel key={fixing.id} drug={fixing} resolved={resolved} onCancel={() => onFix(null)} onApply={(names) => onApplyFix(fixing.id, names)} />}

      {stale && !running && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-sev-moderate-soft px-4 py-3" role="status">
          <span className="flex-[1_1_240px] text-sm font-semibold text-sev-moderate-ink">Danh sách đã thay đổi. Kết quả bên dưới là của lần kiểm tra trước.</span>
          <Button className="h-11" onClick={onRerun} disabled={drugs.length < 2}>
            <RotateCw aria-hidden="true" />
            Kiểm tra lại
          </Button>
        </div>
      )}
    </section>
  );
}

function FixPanel({ drug, resolved, onApply, onCancel }: { drug: DrugEntry; resolved: ResolvedDrug[]; onApply: (names: string[]) => void; onCancel: () => void }) {
  const { r, unknown, missingIngredients } = resolutionOf(drug, resolved);
  const [text, setText] = useState(drug.ingredients?.join(", ") ?? "");
  const names = [...new Set(text.split(/[,;\n+]/).map((s) => s.trim()).filter(Boolean))];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (names.length) onApply(names);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-xl border bg-muted/40 px-4 py-4">
      <p className="font-bold">
        {unknown && !drug.ingredients?.length
          ? `Chưa nhận ra “${drug.name}”. Nhập tên hoạt chất in trên hộp; thuốc nhiều thành phần thì ghi đủ các thành phần.`
          : `Chưa nhận ra ${missingIngredients.map((m) => `“${m}”`).join(", ") || "thành phần nào"} trong “${drug.name}”. Sửa lại danh sách thành phần:`}
      </p>
      {r?.ingredients && r.ingredients.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Kết quả nhận diện thành phần">
          {r.ingredients.map((i) => (
            <li
              key={i.input}
              className={cn(
                "rounded-full px-2.5 py-1 text-[13px] font-semibold",
                i.dbName ? "border border-input bg-card" : "border-[1.5px] border-dashed border-neutral-stroke text-muted-foreground",
              )}
            >
              {i.dbName ? (norm(i.dbName) !== norm(i.input) ? `${i.input} → ${i.dbName}` : i.input) : `${i.input} · chưa có dữ liệu`}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <label htmlFor="fix-input" className="sr-only">
          Tên hoạt chất hoặc thành phần
        </label>
        <Input
          id="fix-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="VD: Ginkgo biloba, Đinh lăng"
          className="h-11 min-w-0 flex-[1_1_260px] bg-card"
          autoFocus
        />
        <Button type="submit" className="h-11" disabled={!names.length}>
          Dùng tên này và kiểm tra lại
        </Button>
        <Button type="button" variant="ghost" className="h-11" onClick={onCancel}>
          Huỷ
        </Button>
      </div>
      <p className="text-[13px] text-muted-foreground">Mẹo: chụp mặt sau hộp, phần “Thành phần”, rồi gõ đúng như in trên đó.</p>
    </form>
  );
}
