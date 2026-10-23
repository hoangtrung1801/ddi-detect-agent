import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, RotateCcw, Search, X } from "lucide-react";
import { v2API } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { EFFECTS, effectOf } from "./effects";
import { Graph3D, type Link } from "./Graph3D";

const MAX_SEEDS = 10;
const NEIGHBOR_STEPS = [0, 10, 25, 50];
const norm = (s: string) => s.trim().toLowerCase();
const endId = (e: unknown) => (typeof e === "object" && e ? (e as { id: string }).id : (e as string));

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

interface InteractionGraphPageProps {
  /** Drugs to start with; with none, the page opens on the database's most-connected drugs. */
  initialDrugs?: string[];
  onCheckDrugs?: (drugs: string[]) => void;
}

export function InteractionGraphPage({ initialDrugs, onCheckDrugs }: InteractionGraphPageProps) {
  const [seeds, setSeeds] = useState<string[]>(() => (initialDrugs ?? []).slice(0, MAX_SEEDS));
  const [neighbors, setNeighbors] = useState(25);
  const [effects, setEffects] = useState(() => new Set(EFFECTS.map((e) => e.id)));
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedLink, setSelectedLink] = useState<Link | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const dq = useDebounced(q.trim(), 200);

  const graph = useQuery({
    queryKey: ["graph", seeds, neighbors],
    queryFn: ({ signal }) => v2API.graph(seeds, neighbors, signal),
    placeholderData: (prev) => prev,
  });
  const suggestions = useQuery({
    queryKey: ["drug-search", dq],
    queryFn: ({ signal }) => v2API.searchDrugs(dq, signal),
    enabled: dq.length >= 2,
  });

  const data = graph.data;
  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const l of data?.links ?? []) {
      const id = effectOf(l.condition).id;
      c.set(id, (c.get(id) ?? 0) + 1);
    }
    return c;
  }, [data]);

  const nodeInfo = useMemo(() => {
    if (!selectedNode || !data) return null;
    const node = data.nodes.find((n) => n.id === selectedNode);
    if (!node) return null;
    const partners = data.links
      .filter((l) => endId(l.source) === selectedNode || endId(l.target) === selectedNode)
      .map((l) => ({ name: endId(l.source) === selectedNode ? endId(l.target) : endId(l.source), condition: l.condition }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { node, partners };
  }, [selectedNode, data]);

  const clearSelection = () => {
    setSelectedNode(null);
    setSelectedLink(null);
  };

  const addSeed = (name: string) => {
    setQ("");
    setOpen(false);
    clearSelection();
    setSeeds((prev) => (prev.length >= MAX_SEEDS || prev.some((s) => norm(s) === norm(name)) ? prev : [...prev, name]));
  };
  const removeSeed = (name: string) => {
    clearSelection();
    setSeeds((prev) => prev.filter((s) => s !== name));
  };

  const toggleEffect = (id: string) =>
    setEffects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="mx-auto grid w-full max-w-[1280px] gap-4 px-4 py-6 sm:px-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      {/* On phones the aside dissolves into the grid so the graph sits between the search and the legend. */}
      <aside className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Đồ thị tương tác 3D</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {seeds.length
              ? "Thuốc bạn chọn và các thuốc tương tác nhiều nhất với chúng."
              : "Đang hiển thị các thuốc có nhiều tương tác nhất trong cơ sở dữ liệu. Thêm thuốc để xem mạng lưới của nó."}
          </p>
        </div>

        <section className="rounded-xl border bg-card p-4">
          <label htmlFor="graph-search" className="text-sm font-semibold">
            Thêm thuốc ({seeds.length}/{MAX_SEEDS})
          </label>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="graph-search"
              value={q}
              autoComplete="off"
              placeholder="VD: Warfarin, Ibuprofen…"
              className="h-11 pl-9"
              disabled={seeds.length >= MAX_SEEDS}
              onChange={(e) => {
                setQ(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && q.trim()) addSeed(suggestions.data?.[0]?.name ?? q.trim());
                if (e.key === "Escape") setOpen(false);
              }}
            />
            {open && dq.length >= 2 && (
              <ul role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border bg-popover py-1 shadow-lg">
                {suggestions.data?.length ? (
                  suggestions.data.map((s) => (
                    <li key={s.name}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={false}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => addSeed(s.name)}
                        className="flex min-h-10 w-full items-center justify-between gap-3 px-3 text-left text-sm hover:bg-muted"
                      >
                        <span className="truncate font-medium">{s.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{s.degree.toLocaleString("vi-VN")}</span>
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="px-3 py-2 text-sm text-muted-foreground">
                    {suggestions.isFetching ? "Đang tìm…" : "Không thấy trong CSDL — nhấn Enter để thử tên khác (biệt dược, tên Việt)."}
                  </li>
                )}
              </ul>
            )}
          </div>

          {seeds.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {seeds.map((s) => {
                const r = data?.resolved.find((x) => x.input === s);
                const missing = data?.unresolved.includes(s);
                return (
                  <li key={s}>
                    <span
                      className={cn(
                        "inline-flex min-h-9 items-center gap-1 rounded-full border py-1 pr-1 pl-3 text-sm font-semibold",
                        missing ? "border-dashed border-sev-major text-sev-major" : "border-primary/40 bg-brand-soft text-brand-ink",
                      )}
                      title={missing ? "Không tìm thấy trong cơ sở dữ liệu" : r && r.name !== s ? `Khớp với ${r.name}` : undefined}
                    >
                      {r && r.name !== s ? `${s} → ${r.name}` : s}
                      <button
                        type="button"
                        onClick={() => removeSeed(s)}
                        aria-label={`Bỏ ${s}`}
                        className="flex size-7 items-center justify-center rounded-full hover:bg-background/70"
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {seeds.length > 0 && (
            <div className="mt-4">
              <span className="text-sm font-semibold">Thuốc tương tác kèm theo, mỗi thuốc</span>
              <div className="mt-2 grid grid-cols-4 gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Số thuốc tương tác kèm theo">
                {NEIGHBOR_STEPS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={neighbors === n}
                    onClick={() => setNeighbors(n)}
                    className={cn(
                      "min-h-9 rounded-md text-sm font-semibold tabular-nums transition-colors",
                      neighbors === n ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {n === 0 ? "Không" : n}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {seeds.length >= 2 && onCheckDrugs && (
              <Button className="h-10 font-semibold" onClick={() => onCheckDrugs(data?.resolved.map((r) => r.name) ?? seeds)}>
                Phân tích bằng AI
              </Button>
            )}
            {seeds.length > 0 && (
              <Button
                variant="outline"
                className="h-10"
                onClick={() => {
                  clearSelection();
                  setSeeds([]);
                }}
              >
                <RotateCcw className="size-4" /> Xem thuốc phổ biến
              </Button>
            )}
          </div>
        </section>

        <section className="order-3 rounded-xl border bg-card p-4 lg:order-none">
          <h2 className="text-sm font-semibold">Loại tương tác</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {EFFECTS.map((e) => {
              const on = effects.has(e.id);
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleEffect(e.id)}
                    className={cn("flex min-h-9 w-full items-center gap-2.5 rounded-md px-2 text-left text-sm hover:bg-muted", !on && "opacity-45")}
                  >
                    <span className="h-1 w-5 shrink-0 rounded-full" style={{ background: e.color }} aria-hidden="true" />
                    <span className="flex-1">{e.label}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{(counts.get(e.id) ?? 0).toLocaleString("vi-VN")}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Kích thước quả cầu theo tổng số tương tác của thuốc. Nhóm được suy ra từ câu mô tả trong CSDL, không phải mức độ nghiêm trọng.
          </p>
        </section>
      </aside>

      <div className="order-2 flex min-w-0 flex-col gap-4 lg:order-none">
        <div className="relative h-[62vh] min-h-[420px] overflow-hidden rounded-xl border bg-[#0B1118] lg:h-[calc(100vh-180px)]">
          {data && (
            <Graph3D
              nodes={data.nodes}
              links={data.links}
              effects={effects}
              selectedNode={selectedNode}
              selectedLink={selectedLink}
              onNodeClick={(n) => {
                setSelectedLink(null);
                setSelectedNode(n.id as string);
              }}
              onLinkClick={(l) => {
                setSelectedNode(null);
                setSelectedLink(l);
              }}
              onBackgroundClick={clearSelection}
            />
          )}

          <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap gap-2 text-xs font-medium text-[#C9D4DE]">
            {data && (
              <span className="rounded-full bg-black/50 px-3 py-1.5 tabular-nums">
                {data.nodes.length} thuốc · {data.links.length.toLocaleString("vi-VN")} tương tác
              </span>
            )}
            {graph.isFetching && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5">
                <Loader2 className="size-3.5 animate-spin" /> Đang tải
              </span>
            )}
          </div>
          <p className="pointer-events-none absolute right-3 bottom-3 hidden rounded-full bg-black/50 px-3 py-1.5 text-xs text-[#C9D4DE] sm:block">
            Kéo để xoay · Cuộn để phóng to · Nhấn vào thuốc hoặc đường nối
          </p>
          {graph.isError && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-[#E6EDF3]">
              Không tải được đồ thị. Kiểm tra máy chủ rồi thử lại.
            </div>
          )}
          {data && seeds.length > 0 && data.resolved.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-[#E6EDF3]">
              Không tìm thấy thuốc nào trong cơ sở dữ liệu.
            </div>
          )}
        </div>

        {(selectedLink || nodeInfo) && (
          <section className="rounded-xl border bg-card p-4" aria-live="polite">
            {selectedLink ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="h-1 w-5 rounded-full" style={{ background: selectedLink.color }} aria-hidden="true" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase">{effectOf(selectedLink.condition).label}</span>
                </div>
                <h2 className="mt-1 text-lg font-bold">
                  {endId(selectedLink.source)} → {endId(selectedLink.target)}
                </h2>
                <p className="mt-1 text-[15px]">{selectedLink.condition}</p>
              </>
            ) : (
              nodeInfo && (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold">{nodeInfo.node.id}</h2>
                      <p className="text-sm text-muted-foreground">
                        {nodeInfo.node.degree.toLocaleString("vi-VN")} tương tác trong CSDL · {nodeInfo.partners.length} hiển thị ở đây
                      </p>
                    </div>
                    {(!nodeInfo.node.seed || !seeds.length) && seeds.length < MAX_SEEDS && (
                      <Button variant="outline" className="h-10" onClick={() => addSeed(nodeInfo.node.id)}>
                        <Plus className="size-4" /> Mở rộng từ thuốc này
                      </Button>
                    )}
                  </div>
                  <ul className="mt-3 grid max-h-64 gap-x-6 gap-y-2 overflow-auto sm:grid-cols-2">
                    {nodeInfo.partners.map((p) => (
                      <li key={p.name} className="flex gap-2.5 text-sm">
                        <span className="mt-2 h-1 w-3 shrink-0 rounded-full" style={{ background: effectOf(p.condition).color }} aria-hidden="true" />
                        <span>
                          <span className="font-semibold">{p.name}</span>
                          <span className="block text-muted-foreground">{p.condition}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )
            )}
          </section>
        )}
      </div>
    </div>
  );
}
