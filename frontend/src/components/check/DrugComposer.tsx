import { forwardRef, useState, type FormEvent } from "react";
import { useDropzone } from "react-dropzone";
import { ArrowRight, Camera, Loader2, RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ResolvedDrug } from "@/lib/report";

export const MAX_DRUGS = 10;

export interface DrugEntry {
  id: string;
  name: string;
  /** File name of the photo the name was read from, if any. */
  source?: string;
  /** Ingredients read from a packaging photo: the entry is then ONE product made of these. */
  ingredients?: string[];
}

export interface PhotoEntry {
  id: string;
  file: File;
  preview: string;
  status: "loading" | "done" | "error";
  /** Product name read from the photo, if legible. */
  product?: string;
  names: string[];
}

interface DrugComposerProps {
  drugs: DrugEntry[];
  photos: PhotoEntry[];
  resolved: ResolvedDrug[];
  running: boolean;
  onAddDrug: (name: string) => void;
  onRemoveDrug: (id: string) => void;
  onClearAll: () => void;
  onAddPhotos: (files: File[]) => void;
  onRemovePhoto: (id: string) => void;
  onRetryPhoto: (id: string) => void;
  onCheck: () => void;
}

const norm = (s: string) => s.trim().toLowerCase();

export const DrugComposer = forwardRef<HTMLInputElement, DrugComposerProps>(function DrugComposer(
  { drugs, photos, resolved, running, onAddDrug, onRemoveDrug, onClearAll, onAddPhotos, onRemovePhoto, onRetryPhoto, onCheck },
  inputRef,
) {
  const [name, setName] = useState("");
  const full = drugs.length >= MAX_DRUGS;
  const pairCount = (drugs.length * (drugs.length - 1)) / 2;

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: { "image/*": [] },
    maxSize: 8 * 1024 * 1024,
    noClick: true,
    onDrop: (files) => files.length && onAddPhotos(files),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || full) return;
    // Allow pasting several names at once: "Coumadin, Advil".
    for (const part of name.split(/[,;\n]/)) if (part.trim()) onAddDrug(part.trim());
    setName("");
  };

  const statusOf = (d: DrugEntry) => resolved.find((r) => norm(r.input) === norm(d.name));

  return (
    <section aria-labelledby="composer-title" className="flex flex-col gap-5 rounded-2xl border bg-card p-6">
      <div className="flex flex-col gap-1">
        <h1 id="composer-title" className="text-[22px] font-bold tracking-tight">
          Kiểm tra tương tác thuốc
        </h1>
        <p className="text-muted-foreground">Nhập tên thuốc hoặc chụp hộp thuốc. Dùng được cả tên biệt dược.</p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-1.5">
        <label htmlFor="drug-input" className="text-sm font-semibold">
          Thêm thuốc
        </label>
        <div className="flex gap-2">
          <Input
            id="drug-input"
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: Coumadin, Panadol…"
            disabled={full}
            className="h-11 bg-card"
          />
          <Button type="submit" variant="secondary" className="h-11 px-5 font-semibold" disabled={!name.trim() || full}>
            Thêm
          </Button>
        </div>
        {full && <p className="text-sm text-muted-foreground">Tối đa {MAX_DRUGS} thuốc mỗi lần kiểm tra.</p>}
      </form>

      <div
        {...getRootProps()}
        className={cn(
          "flex items-center gap-3.5 rounded-xl border-[1.5px] border-dashed p-4 transition-colors",
          isDragActive ? "border-primary bg-brand-soft" : "border-neutral-line bg-muted/40",
        )}
      >
        <input {...getInputProps()} aria-label="Chọn ảnh hộp thuốc" />
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border bg-card">
          <Camera className="size-5 text-primary" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">Kéo ảnh hộp thuốc, đơn thuốc vào đây</div>
          <div className="text-sm text-muted-foreground">
            JPG, PNG · tối đa 8 MB ·{" "}
            <button type="button" onClick={open} className="font-medium text-primary underline-offset-2 hover:underline">
              chọn ảnh
            </button>
          </div>
        </div>
      </div>

      {photos.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Ảnh đã tải lên">
          {photos.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl border px-2 py-2">
              <img src={p.preview} alt="" className="size-11 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{p.file.name}</div>
                <div className="text-xs text-muted-foreground">
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

      <div className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Danh sách thuốc ({drugs.length})</h2>
          {drugs.length > 0 && (
            <button type="button" onClick={onClearAll} className="py-2 text-sm text-muted-foreground hover:text-foreground">
              Xoá tất cả
            </button>
          )}
        </div>
        {drugs.length === 0 ? (
          <p className="rounded-xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">Chưa có thuốc nào.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {drugs.map((d) => {
              const r = statusOf(d);
              const unknown = r && !r.dbName;
              // A multi-ingredient product is identified by its ingredients: show how many matched.
              const matchedIngredients = r?.ingredients?.filter((i) => i.dbName).length;
              const ingredientTotal = r?.ingredients?.length;
              const renamed = r?.dbName && norm(r.dbName) !== norm(d.name);
              return (
                <li
                  key={d.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl py-1.5 pr-1.5 pl-3.5",
                    unknown ? "border-[1.5px] border-dashed border-neutral-line bg-muted/40" : "border",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold break-words">{renamed ? r.dbName : d.name}</div>
                    {(renamed || d.source || unknown || d.ingredients?.length) && (
                      <div className="text-xs text-muted-foreground">
                        {[
                          renamed && `Bạn nhập “${d.name}”`,
                          d.ingredients?.length && `${d.ingredients.length} thành phần`,
                          d.source && `từ ảnh ${d.source}`,
                          unknown && (d.ingredients?.length ? "Không khớp thành phần nào" : "Không khớp hoạt chất nào"),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    )}
                    {d.ingredients && d.ingredients.length > 0 && (
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer py-1 select-none">Xem thành phần</summary>
                        <ul className="flex flex-wrap gap-1 pb-1">
                          {d.ingredients.map((name) => {
                            const m = r?.ingredients?.find((i) => norm(i.input) === norm(name));
                            const missing = m && !m.dbName;
                            return (
                              <li
                                key={name}
                                className={cn(
                                  "rounded-full px-2 py-0.5",
                                  missing ? "border border-dashed border-neutral-line" : "bg-brand-soft text-brand-ink",
                                )}
                                title={missing ? "Chưa có trong cơ sở dữ liệu tương tác" : m?.dbName ? `Khớp: ${m.dbName}` : undefined}
                              >
                                {m?.dbName && norm(m.dbName) !== norm(name) ? `${name} → ${m.dbName}` : name}
                              </li>
                            );
                          })}
                        </ul>
                      </details>
                    )}
                  </div>
                  {r && (
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
                        unknown ? "bg-neutral-soft text-neutral-ink" : "bg-brand-soft text-brand-ink",
                      )}
                    >
                      {unknown
                        ? "Không xác định"
                        : ingredientTotal
                          ? `Nhận diện ${matchedIngredients}/${ingredientTotal} thành phần`
                          : "Đã nhận diện"}
                    </span>
                  )}
                  <Button variant="ghost" size="icon-lg" className="size-11 shrink-0" onClick={() => onRemoveDrug(d.id)} aria-label={`Xoá ${d.name}`}>
                    <X aria-hidden="true" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Button onClick={onCheck} disabled={drugs.length < 2 || running} className="h-13 rounded-xl text-base font-semibold">
        {running ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" />
            Đang kiểm tra…
          </>
        ) : drugs.length < 2 ? (
          "Thêm ít nhất 2 thuốc để kiểm tra"
        ) : (
          <>
            Kiểm tra {pairCount} cặp thuốc
            <ArrowRight aria-hidden="true" />
          </>
        )}
      </Button>
    </section>
  );
});
