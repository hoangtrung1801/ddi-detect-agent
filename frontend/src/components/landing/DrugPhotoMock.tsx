/** Drawn stand-in for a phone photo of a drug box and blister strip, with the drugs the AI picked out. */
export function DrugPhotoMock({ className }: { className?: string }) {
  const tablet = "rounded-full bg-[#F4F1EA] shadow-[inset_0_-2px_3px_rgba(0,0,0,0.12)]";
  return (
    <figure className={className} role="img" aria-label="Ảnh chụp hộp thuốc Warfarin và vỉ Ibuprofen, AI khoanh vùng và đọc được tên 2 thuốc">
      <div className="relative h-[210px] overflow-hidden rounded-[14px] bg-[#C9B9A3] shadow-[inset_0_0_60px_rgba(60,40,20,0.35)]">
        <div className="absolute top-[16%] left-[7%] flex h-[60%] w-[52%] -rotate-[7deg] flex-col overflow-hidden rounded bg-[#FBFBF8] shadow-[0_10px_18px_rgba(40,25,10,0.35)]">
          <div className="h-[26%] bg-[#2F6FB0]" />
          <div className="flex flex-col gap-0.5 px-2.5 py-1.5">
            <span className="text-[15px] font-extrabold text-[#1E3550]">Warfarin</span>
            <span className="text-[10px] font-semibold text-[#4A5A6A]">5 mg · 30 viên nén</span>
            <span className="mt-1 h-[3px] w-[70%] rounded-sm bg-[#D9DEE3]" />
            <span className="h-[3px] w-1/2 rounded-sm bg-[#D9DEE3]" />
          </div>
        </div>
        <div className="absolute top-[34%] right-[6%] grid h-[54%] w-[40%] rotate-[9deg] grid-cols-3 gap-[5px] rounded-md bg-[#D7DCE1] p-[7px] shadow-[0_8px_14px_rgba(40,25,10,0.3)]">
          <span className={tablet} />
          <span className={tablet} />
          <span className={tablet} />
          <span className="col-span-3 self-center text-center text-[9px] font-bold text-neutral-ink">IBUPROFEN 400 mg</span>
          <span className={tablet} />
          <span className={tablet} />
          <span className={tablet} />
        </div>
        <div className="absolute top-[26%] left-[9%] h-[26%] w-[36%] rounded-md border-2 border-[#3FD3C6]" />
        <span className="absolute top-[9%] left-[9%] rounded-md bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">Warfarin</span>
        <div className="absolute top-[52%] right-[8%] h-[16%] w-[34%] rounded-md border-2 border-[#3FD3C6]" />
        <span className="absolute right-[8%] bottom-[6%] rounded-md bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">Ibuprofen</span>
      </div>
      <figcaption className="mt-2.5 text-sm text-neutral-ink">Đã đọc 2 thuốc từ ảnh</figcaption>
    </figure>
  );
}
