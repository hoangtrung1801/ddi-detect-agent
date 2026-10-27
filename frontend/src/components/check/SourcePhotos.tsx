import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { PhotoEntry } from "./types";

/** What was read from a photo, in words. */
export function photoReading(p: PhotoEntry): string {
  if (p.status === "loading") return "Đang đọc…";
  if (p.status === "error") return "Không đọc được ảnh";
  if (!p.names.length) return "Không đọc được tên thuốc nào";
  return p.names.length > 1 ? `${p.product ?? "1 sản phẩm"}: ${p.names.join(", ")}` : p.names[0]!;
}

interface SourcePhotosProps {
  photos: PhotoEntry[];
  viewId: string | null;
  onView: (id: string | null) => void;
}

/** The user's own photos next to the result, so they can check the box against what was read. */
export function SourcePhotos({ photos, viewId, onView }: SourcePhotosProps) {
  const viewing = photos.find((p) => p.id === viewId);
  if (!photos.length) return null;

  return (
    <section aria-labelledby="photos-title" className="flex flex-col gap-3 rounded-2xl border bg-card px-5 py-4 print:break-inside-avoid">
      <div className="flex flex-col">
        <h2 id="photos-title" className="text-[15px] font-bold">
          Ảnh gốc ({photos.length})
        </h2>
        <p className="text-[13px] text-muted-foreground">Đối chiếu tên trên hộp với những gì AI đã đọc.</p>
      </div>
      <ul className="grid grid-cols-2 gap-2.5">
        {photos.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onView(p.id)}
              aria-label={`Xem ảnh ${p.file.name} cỡ lớn`}
              className="group flex w-full flex-col gap-1.5 rounded-xl text-left"
            >
              <img src={p.preview} alt="" className="aspect-[4/3] w-full rounded-lg border object-cover transition-opacity group-hover:opacity-85" />
              <span className="line-clamp-2 text-xs leading-snug text-neutral-ink">{photoReading(p)}</span>
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && onView(null)}>
        <DialogContent className="max-h-[92vh] max-w-[min(920px,94vw)] gap-3 overflow-y-auto">
          {viewing && (
            <>
              <DialogTitle className="pr-8 text-base font-bold break-all">{viewing.file.name}</DialogTitle>
              <DialogDescription>Đọc được: {photoReading(viewing)}</DialogDescription>
              <img src={viewing.preview} alt={`Ảnh ${viewing.file.name}`} className="max-h-[72vh] w-full rounded-lg object-contain" />
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
