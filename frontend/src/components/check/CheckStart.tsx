import { forwardRef, useState, type FormEvent } from "react";
import { useDropzone } from "react-dropzone";
import { ArrowRight, Camera, Check, Layers, Loader2, Pill, RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DrugSearch } from "./DrugSearch";
import { MAX_DRUGS, type DrugEntry, type PhotoEntry, type ProductKind } from "./types";

export const PRODUCT_TAG: Record<Exclude<ProductKind, "drug">, { label: string; className: string }> = {
  multi: { label: "Nhiều thành phần", className: "bg-sev-minor-soft text-sev-minor" },
  supplement: { label: "Thực phẩm chức năng", className: "bg-sev-moderate-soft text-sev-moderate-ink" },
};

export const productKind = (d: DrugEntry): ProductKind => d.kind ?? (d.ingredients?.length ? "multi" : "drug");

interface CheckStartProps {
  drugs: DrugEntry[];
  photos: PhotoEntry[];
  /** Names in the user's medicine cabinet, or null when signed out. */
  cabinet: string[] | null;
  onAddDrug: (name: string) => void;
  onAddProduct: (name: string, ingredients: string[], kind: ProductKind) => void;
  onRemoveDrug: (id: string) => void;
  onClearAll: () => void;
  onAddPhotos: (files: File[]) => void;
  onRemovePhoto: (id: string) => void;
  onRetryPhoto: (id: string) => void;
  onCheck: () => void;
  onRequireLogin?: () => void;
}

const STEPS = ["Thêm thuốc", "Xem kết luận", "Lưu hoặc hỏi thêm"];

/** Step 1 of a check: collect drugs, multi-ingredient products and supplements. */
export const CheckStart = forwardRef<HTMLInputElement, CheckStartProps>(function CheckStart(
  { drugs, photos, cabinet, onAddDrug, onAddProduct, onRemoveDrug, onClearAll, onAddPhotos, onRemovePhoto, onRetryPhoto, onCheck, onRequireLogin },
  inputRef,
) {
  const [productOpen, setProductOpen] = useState(false);
  const full = drugs.length >= MAX_DRUGS;
  const pairCount = (drugs.length * (drugs.length - 1)) / 2;
  const products = drugs.filter((d) => d.ingredients?.length);
  const actives = drugs.reduce((n, d) => n + Math.max(1, d.ingredients?.length ?? 0), 0);
  const added = new Set(drugs.map((d) => d.name.toLowerCase()));
  const quick = (cabinet ?? []).filter((n) => !added.has(n.toLowerCase())).slice(0, 6);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: { "image/*": [] },
    maxSize: 8 * 1024 * 1024,
    noClick: true,
    noKeyboard: true,
    onDrop: (files) => files.length && onAddPhotos(files),
  });

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5 px-4 py-8 sm:px-6 sm:py-10">
      <ol aria-label="Các bước" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === 0 ? "step" : undefined} className={cn("flex items-center gap-2", i === 0 ? "font-bold" : "text-muted-foreground")}>
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-[13px]",
                i === 0 ? "bg-foreground text-background" : "border-[1.5px] border-neutral-stroke",
              )}
            >
              {i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight sm:text-[32px]">Bạn đang dùng những thuốc nào?</h1>
        <p className="text-base text-neutral-ink">
          Thuốc, thuốc nhiều thành phần hay thực phẩm chức năng đều được. Nhập tên in trên hộp; cần ít nhất 2 sản phẩm.
        </p>
      </div>

      <section
        aria-label="Thêm thuốc"
        {...getRootProps({ role: "region" })}
        className={cn("flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5", isDragActive && "border-primary ring-2 ring-primary/30")}
      >
        <input {...getInputProps()} aria-label="Chọn ảnh hộp thuốc" />
        <div className="flex flex-col gap-1.5">
          <span className="font-bold" aria-hidden="true">
            Tên thuốc hoặc thực phẩm chức năng
          </span>
          <DrugSearch ref={inputRef} onAdd={onAddDrug} disabled={full} />
          <p className="text-[13px] text-muted-foreground">
            {full ? `Tối đa ${MAX_DRUGS} sản phẩm mỗi lần kiểm tra.` : "Có thể dán nhiều tên một lúc, cách nhau bằng dấu phẩy."}
          </p>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-3">
          <Tile icon={Camera} title="Chụp hộp thuốc" note="hoặc đơn thuốc, AI đọc tên giúp bạn" onClick={open} disabled={full} dashed />
          <Tile icon={Layers} title="Nhiều thành phần" note="nhập từng thành phần trên nhãn" onClick={() => setProductOpen((o) => !o)} disabled={full} pressed={productOpen} />
          <Tile
            icon={Pill}
            title="Lấy từ tủ thuốc"
            note={cabinet === null ? "đăng nhập để dùng" : cabinet.length ? `${cabinet.length} thuốc bạn đang dùng` : "tủ thuốc đang trống"}
            onClick={() => (cabinet === null ? onRequireLogin?.() : cabinet.forEach((n) => onAddDrug(n)))}
            disabled={cabinet !== null && (!quick.length || full)}
          />
        </div>

        {productOpen && (
          <ProductForm
            onCancel={() => setProductOpen(false)}
            onSubmit={(name, ingredients, kind) => {
              onAddProduct(name, ingredients, kind);
              setProductOpen(false);
            }}
          />
        )}

        {photos.length > 0 && (
          <ul className="flex flex-col gap-2" aria-label="Ảnh đã tải lên">
            {photos.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl border p-2">
                <img src={p.preview} alt="" className="size-11 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.file.name}</div>
                  <div className="text-xs text-muted-foreground" aria-live="polite">
                    {p.status === "loading" && (
                      <span className="inline-flex items-center gap-1">
                        <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                        Đang đọc tên thuốc…
                      </span>
                    )}
                    {p.status === "done" &&
                      (p.names.length > 1
                        ? `Đọc được: ${p.product ?? "1 sản phẩm"} · ${p.names.length} thành phần`
                        : p.names.length
                          ? `Đọc được: ${p.names[0]}`
                          : "Không đọc được tên thuốc nào")}
                    {p.status === "error" && <span className="text-sev-major">Không đọc được ảnh</span>}
                  </div>
                </div>
                {p.status === "error" && (
                  <Button variant="ghost" size="icon-lg" className="size-11" onClick={() => onRetryPhoto(p.id)} aria-label={`Thử lại ảnh ${p.file.name}`}>
                    <RotateCw aria-hidden="true" />
                  </Button>
                )}
                <Button variant="ghost" size="icon-lg" className="size-11" onClick={() => onRemovePhoto(p.id)} aria-label={`Xoá ảnh ${p.file.name}`}>
                  <X aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[15px] font-bold">Đã thêm ({drugs.length})</h2>
            {drugs.length > 0 && (
              <button type="button" onClick={onClearAll} className="py-2 text-sm text-muted-foreground hover:text-foreground">
                Xoá hết
              </button>
            )}
          </div>
          {drugs.length === 0 ? (
            <p className="rounded-xl bg-muted/60 px-4 py-4 text-center text-muted-foreground">
              Chưa có thuốc nào. Gõ tên ở trên, chụp hộp thuốc hoặc kéo ảnh vào đây.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {drugs.map((d) => (
                <AddedItem key={d.id} drug={d} onRemove={() => onRemoveDrug(d.id)} />
              ))}
            </ul>
          )}
          {quick.length > 0 && !full && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[13px] text-muted-foreground">Thêm nhanh từ tủ thuốc:</span>
              {quick.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onAddDrug(n)}
                  className="min-h-9 rounded-full border border-input bg-card px-3 text-sm font-semibold hover:border-foreground"
                >
                  + {n}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="flex flex-col gap-2">
        <Button onClick={onCheck} disabled={drugs.length < 2} className="h-14 rounded-2xl text-[17px] font-bold">
          {drugs.length < 2 ? (
            "Thêm ít nhất 2 sản phẩm để kiểm tra"
          ) : (
            <>
              Kiểm tra {drugs.length} sản phẩm ({pairCount} cặp)
              <ArrowRight aria-hidden="true" />
            </>
          )}
        </Button>
        <p className="text-center text-[13px] text-muted-foreground">
          {products.length > 0 && `Tổng cộng ${actives} hoạt chất được đối chiếu với nhau. `}
          Mỗi cặp được tra trong cơ sở dữ liệu DDInter 2.0. Kết quả chỉ mang tính tham khảo.
        </p>
      </div>
    </div>
  );
});

function Tile({
  icon: Icon,
  title,
  note,
  onClick,
  disabled,
  dashed,
  pressed,
}: {
  icon: typeof Camera;
  title: string;
  note: string;
  onClick: () => void;
  disabled?: boolean;
  dashed?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      className={cn(
        "flex min-h-16 items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition-colors hover:border-foreground disabled:pointer-events-none disabled:opacity-50 sm:flex-col sm:items-start sm:gap-2 sm:py-3",
        dashed ? "border-[1.5px] border-dashed border-neutral-line bg-muted/40" : "border bg-card",
        pressed && "border-foreground bg-muted/60",
      )}
    >
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", dashed ? "bg-brand-soft text-primary" : "bg-muted text-neutral-ink")}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="font-bold">{title}</span>
        <span className="text-[13px] text-muted-foreground">{note}</span>
      </span>
    </button>
  );
}

function ProductForm({ onSubmit, onCancel }: { onSubmit: (name: string, ingredients: string[], kind: ProductKind) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ProductKind>("multi");
  const [list, setList] = useState("");
  const ingredients = [...new Set(list.split(/[,;\n+]/).map((s) => s.trim()).filter(Boolean))];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !ingredients.length) return;
    onSubmit(name.trim(), ingredients, kind);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-xl border bg-muted/40 p-4">
      <div role="group" aria-label="Loại sản phẩm" className="flex w-fit rounded-lg bg-muted p-0.5">
        {(["multi", "supplement"] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={cn("min-h-9 rounded-md px-3 text-sm font-semibold", kind === k ? "bg-card shadow-sm" : "text-neutral-ink")}
          >
            {k === "multi" ? "Thuốc nhiều thành phần" : "Thực phẩm chức năng"}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="product-name" className="text-sm font-semibold">
            Tên sản phẩm
          </label>
          <Input id="product-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Decolgen Forte" className="h-11 bg-card" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="product-ingredients" className="text-sm font-semibold">
            Thành phần trên nhãn
          </label>
          <Input
            id="product-ingredients"
            value={list}
            onChange={(e) => setList(e.target.value)}
            placeholder="VD: Paracetamol, Phenylephrine, Chlorpheniramine"
            className="h-11 bg-card"
          />
        </div>
      </div>
      {ingredients.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Thành phần sẽ được kiểm tra">
          {ingredients.map((i) => (
            <li key={i} className="rounded-full border border-input bg-card px-2.5 py-1 text-[13px] font-semibold">
              {i}
            </li>
          ))}
        </ul>
      )}
      <p className="text-[13px] text-muted-foreground">Mỗi thành phần được kiểm tra riêng với các thuốc khác. Thành phần thảo dược có thể chưa có trong cơ sở dữ liệu.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="h-11 px-5" disabled={!name.trim() || !ingredients.length}>
          Thêm sản phẩm
        </Button>
        <Button type="button" variant="ghost" className="h-11" onClick={onCancel}>
          Huỷ
        </Button>
      </div>
    </form>
  );
}

function AddedItem({ drug, onRemove }: { drug: DrugEntry; onRemove: () => void }) {
  const kind = productKind(drug);
  const tag = kind !== "drug" ? PRODUCT_TAG[kind] : null;
  const from = drug.source ? `Đọc từ ảnh ${drug.source}` : drug.ingredients?.length ? `${drug.ingredients.length} thành phần` : null;
  return (
    <li className="flex flex-col gap-2 rounded-xl border bg-card py-1.5 pr-1.5 pl-3.5">
      <div className="flex min-h-11 items-center gap-3">
        <Check className="size-[18px] shrink-0 text-primary" strokeWidth={2.5} aria-hidden="true" />
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-bold break-words">{drug.name}</span>
            {tag && <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-bold", tag.className)}>{tag.label}</span>}
          </span>
          {from && <span className="text-[13px] text-muted-foreground">{from}</span>}
        </div>
        <Button variant="ghost" size="icon-lg" className="size-11 shrink-0" onClick={onRemove} aria-label={`Bỏ ${drug.name}`}>
          <X aria-hidden="true" />
        </Button>
      </div>
      {drug.ingredients && drug.ingredients.length > 0 && (
        <div className="mb-2 ml-[30px] flex flex-col gap-2 rounded-lg bg-muted/60 px-3 py-2.5">
          <span className="text-[13px] text-neutral-ink">
            {kind === "supplement"
              ? "Thực phẩm chức năng: kiểm tra theo từng thành phần ghi trên nhãn."
              : `Gồm ${drug.ingredients.length} hoạt chất, mỗi hoạt chất được kiểm tra riêng với các thuốc khác.`}
          </span>
          <ul className="flex flex-wrap gap-1.5">
            {drug.ingredients.map((i) => (
              <li key={i} className="rounded-full border border-input bg-card px-2.5 py-1 text-[13px] font-semibold">
                {i}
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}
