import { forwardRef, useEffect, useId, useState, type KeyboardEvent } from "react";
import { Plus, Search } from "lucide-react";
import { v2API } from "@/lib/api";
import { cn } from "@/lib/utils";

interface DrugSearchProps {
  /** Called once per name; a pasted "Coumadin, Advil" adds two. */
  onAdd: (name: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

/** Name box with suggestions from the interaction database. What the user typed is always the first option, so brand names still work. */
export const DrugSearch = forwardRef<HTMLInputElement, DrugSearchProps>(function DrugSearch(
  { onAdd, disabled, placeholder = "VD: Coumadin, Panadol, dầu cá Omega-3…", className, inputClassName },
  ref,
) {
  const listId = useId();
  const [text, setText] = useState("");
  const [hits, setHits] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  // null: the default option, the database match when it starts with what was typed.
  const [picked, setPicked] = useState<number | null>(null);
  const query = text.trim();

  useEffect(() => {
    // Several names pasted at once are added as typed, not searched.
    if (query.length < 2 || /[,;\n]/.test(query)) {
      setHits([]);
      return;
    }
    const ac = new AbortController();
    const t = setTimeout(() => {
      v2API
        .searchDrugs(query, ac.signal)
        .then((r) => setHits(r.map((x) => x.name).filter((n) => n.toLowerCase() !== query.toLowerCase())))
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [query]);

  const options = query ? [query, ...hits] : [];
  const active = Math.min(picked ?? (hits[0]?.toLowerCase().startsWith(query.toLowerCase()) ? 1 : 0), Math.max(options.length - 1, 0));
  const showList = open && options.length > 0;

  const add = (value: string) => {
    for (const part of value.split(/[,;\n]/)) if (part.trim()) onAdd(part.trim());
    setText("");
    setHits([]);
    setPicked(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && options.length) {
      e.preventDefault();
      setOpen(true);
      setPicked((active + 1) % options.length);
    } else if (e.key === "ArrowUp" && options.length) {
      e.preventDefault();
      setPicked((active - 1 + options.length) % options.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (options.length) add(options[active]!);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        ref={ref}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
        aria-label="Tên thuốc hoặc thực phẩm chức năng"
        autoComplete="off"
        value={text}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          setPicked(null);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className={cn(
          "h-13 w-full rounded-xl border-2 border-input bg-card pr-4 pl-12 text-[17px] outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground disabled:opacity-60",
          inputClassName,
        )}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Gợi ý"
          className="absolute inset-x-0 top-full z-20 mt-1.5 flex flex-col gap-0.5 rounded-xl border bg-card p-1.5 shadow-[0_12px_28px_rgba(15,26,36,0.12)]"
        >
          {options.map((o, i) => (
            <li
              key={`${i}-${o}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown, not click: the input's blur would close the list first.
              onMouseDown={(e) => {
                e.preventDefault();
                add(o);
              }}
              onMouseEnter={() => setPicked(i)}
              className={cn("flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-3 py-2", i === active && "bg-brand-soft/60")}
            >
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate font-bold">{i === 0 ? `“${o}”` : o}</span>
                <span className="text-[13px] text-muted-foreground">
                  {i === 0 ? "Thêm đúng như bạn gõ, tên biệt dược cũng được" : "Hoạt chất có trong cơ sở dữ liệu"}
                </span>
              </span>
              <Plus className="size-4 shrink-0 text-brand-ink" aria-hidden="true" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
