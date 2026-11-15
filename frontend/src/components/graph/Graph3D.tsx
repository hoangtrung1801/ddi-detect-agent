import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import ForceGraph3D, { type ForceGraphMethods, type LinkObject, type NodeObject } from "react-force-graph-3d";
import * as THREE from "three";
import type { GraphLink, GraphNode } from "@/lib/api";
import { sevOf } from "./severity";

export type Node = NodeObject<GraphNode>;
export type Link = LinkObject<GraphNode, GraphLink>;
export type LabelMode = "auto" | "all" | "none";

export interface GraphHandle {
  zoomToFit: () => void;
  resetCamera: () => void;
  flyTo: (id: string) => void;
  /** PNG data URL of the current view. */
  screenshot: () => string | null;
}

interface Graph3DProps {
  ref?: Ref<GraphHandle>;
  nodes: GraphNode[];
  /** Already filtered by the page (severity, scope, hidden drugs). */
  links: GraphLink[];
  selectedNode: string | null;
  /** pairKey() of the selected interaction. */
  selectedPair: string | null;
  labels: LabelMode;
  dims: 2 | 3;
  onNodeClick: (id: string) => void;
  onLinkClick: (a: string, b: string) => void;
  onBackgroundClick: () => void;
}

const BG = "#0B1118";
const SEED = "#3FD0C9";
const NODE = "#9FB3C8";
const DIM = "#26313C";
/** In auto mode, this many best-connected drugs are labelled besides the seeds. */
const AUTO_LABELS = 12;
/** Above this many seeds (the hub view), seeds are not all labelled or tinted. */
const LABEL_ALL_SEEDS = 12;

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const endId = (e: unknown): string => (typeof e === "object" && e ? ((e as Node).id as string) : (e as string));
const linkKey = (l: Link) => pairKey(endId(l.source), endId(l.target));

function useSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** Text sprites, cached: building a canvas texture per node on every re-render is what made hovering stutter. */
const spriteCache = new Map<string, THREE.Sprite>();
function labelSprite(text: string, color: string, bold: boolean): THREE.Sprite {
  const key = `${text}|${color}|${bold}`;
  const hit = spriteCache.get(key);
  if (hit) return hit.clone();
  const font = `${bold ? 700 : 500} 44px "Be Vietnam Pro", system-ui, sans-serif`;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 24;
  canvas.width = w;
  canvas.height = 64;
  ctx.font = font;
  ctx.fillStyle = "rgba(8,13,19,0.78)";
  ctx.beginPath();
  ctx.roundRect(0, 4, w, 56, 14);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 12, 33);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  const scale = bold ? 0.16 : 0.12;
  sprite.scale.set(w * scale, 64 * scale, 1);
  if (spriteCache.size > 600) spriteCache.clear();
  spriteCache.set(key, sprite);
  return sprite.clone();
}

const radius = (degree: number) => 1.5 + Math.log2(1 + degree) * 0.55;

/** Force-directed view: spheres are drugs (sized by how many drugs they interact with), lines are interactions coloured by DDInter risk level. */
export function Graph3D({ ref, nodes, links, selectedNode, selectedPair, labels, dims, onNodeClick, onLinkClick, onBackgroundClick }: Graph3DProps) {
  const [boxRef, size] = useSize();
  const fg = useRef<ForceGraphMethods<Node, Link>>(undefined);
  const [hover, setHover] = useState<string | null>(null);

  // A fresh object per response: the force engine mutates nodes and links in place.
  // Positions survive filter changes so toggling a severity does not re-shuffle the layout.
  const positions = useRef(new Map<string, { x?: number; y?: number; z?: number }>());
  const data = useMemo(() => {
    const ns = nodes.map((n) => ({ ...positions.current.get(n.id), ...n })) as Node[];
    return { nodes: ns, links: links.map((l) => ({ ...l })) as Link[] };
  }, [nodes, links]);
  useEffect(() => {
    return () => {
      for (const n of data.nodes) positions.current.set(n.id as string, { x: n.x, y: n.y, z: n.z });
    };
  }, [data]);

  const seedCount = useMemo(() => nodes.filter((n) => n.seed).length, [nodes]);
  const tintSeeds = seedCount <= LABEL_ALL_SEEDS;
  const autoLabelled = useMemo(() => {
    const s = new Set<string>();
    if (tintSeeds) for (const n of nodes) if (n.seed) s.add(n.id);
    for (const n of [...nodes].sort((a, b) => b.degree - a.degree).slice(0, AUTO_LABELS)) s.add(n.id);
    return s;
  }, [nodes, tintSeeds]);

  const [pairA, pairB] = selectedPair ? selectedPair.split("|") : [];
  // Hovering or selecting a drug highlights it and its direct partners; everything else fades.
  const focus = hover ?? selectedNode;
  const near = useMemo(() => {
    if (!focus) return null;
    const s = new Set([focus]);
    for (const l of data.links) {
      const a = endId(l.source);
      const b = endId(l.target);
      if (a === focus) s.add(b);
      if (b === focus) s.add(a);
    }
    return s;
  }, [focus, data.links]);

  const isSel = (l: Link) => selectedPair !== null && linkKey(l) === selectedPair;
  const linkLit = (l: Link) => {
    if (selectedPair && !focus) return isSel(l);
    return !focus || endId(l.source) === focus || endId(l.target) === focus;
  };
  const nodeLit = (id: string) => {
    if (near) return near.has(id);
    if (selectedPair) return id === pairA || id === pairB;
    return true;
  };

  useEffect(() => {
    const g = fg.current;
    if (!g) return;
    // Spread the layout out as the graph grows, so labels and edges stay readable.
    const n = data.nodes.length;
    g.d3Force("charge")?.strength(-(180 + Math.min(n, 200) * 3));
    g.d3Force("link")?.distance(70 + Math.min(n, 200) * 0.35);
    g.d3ReheatSimulation();
  }, [data]);

  const fitted = useRef(false);
  useEffect(() => {
    fitted.current = false;
  }, [nodes]);

  const flyTo = (n: Node) => {
    const dist = 220;
    const { x = 0, y = 0, z = 0 } = n;
    const r = Math.hypot(x, y, z) || 1;
    fg.current?.cameraPosition({ x: x * (1 + dist / r), y: y * (1 + dist / r), z: z * (1 + dist / r) }, { x, y, z }, 900);
  };

  useImperativeHandle(
    ref,
    () => ({
      zoomToFit: () => fg.current?.zoomToFit(600, 40),
      resetCamera: () => {
        fg.current?.cameraPosition({ x: 0, y: 0, z: 600 }, { x: 0, y: 0, z: 0 }, 0);
        fg.current?.zoomToFit(600, 40);
      },
      flyTo: (id) => {
        const n = data.nodes.find((x) => x.id === id);
        if (n) flyTo(n);
      },
      screenshot: () => fg.current?.renderer().domElement.toDataURL("image/png") ?? null,
    }),
    [data],
  );

  return (
    <div ref={boxRef} className="absolute inset-0">
      {size.w > 0 && (
        <ForceGraph3D<GraphNode, GraphLink>
          ref={fg}
          width={size.w}
          height={size.h}
          graphData={data}
          numDimensions={dims}
          rendererConfig={{ preserveDrawingBuffer: true, antialias: true }}
          backgroundColor={BG}
          showNavInfo={false}
          nodeId="id"
          nodeVal={(n) => radius(n.degree) ** 3}
          nodeRelSize={1}
          nodeResolution={16}
          nodeOpacity={0.95}
          nodeColor={(n) => (!nodeLit(n.id) ? DIM : n.seed && tintSeeds ? SEED : NODE)}
          nodeLabel={(n) => `<b>${n.id}</b><br/>${n.degree.toLocaleString("vi-VN")} tương tác trong CSDL`}
          nodeThreeObjectExtend
          nodeThreeObject={(n) => {
            const picked = n.id === selectedNode || n.id === pairA || n.id === pairB;
            const show =
              picked || (near ? near.has(n.id) : labels === "all" || (labels === "auto" && autoLabelled.has(n.id)));
            if (!show || (labels === "none" && !picked && !near)) return new THREE.Object3D();
            const seedTint = n.seed && tintSeeds;
            const s = labelSprite(n.id, seedTint ? "#7FE0DA" : "#E6EDF3", seedTint || picked);
            s.position.y = -(radius(n.degree) + 4);
            return s;
          }}
          linkColor={(l) => (linkLit(l) ? sevOf(l.severity).color : DIM)}
          linkOpacity={0.6}
          linkWidth={(l) => (isSel(l) ? 1.8 : linkLit(l) && (focus || selectedPair) ? (l.severity === "major" ? 1.1 : 0.7) : l.severity === "major" ? 0.45 : 0.2)}
          linkDirectionalParticles={(l) => (isSel(l) ? 4 : 0)}
          linkDirectionalParticleWidth={1.8}
          linkDirectionalParticleColor={(l) => sevOf(l.severity).color}
          linkLabel={(l) => `<b>${endId(l.source)} + ${endId(l.target)}</b><br/>${sevOf(l.severity).label}`}
          linkHoverPrecision={4}
          onNodeHover={(n) => setHover(n ? (n.id as string) : null)}
          onNodeClick={(n) => {
            flyTo(n);
            onNodeClick(n.id as string);
          }}
          onLinkClick={(l) => onLinkClick(endId(l.source), endId(l.target))}
          onBackgroundClick={onBackgroundClick}
          onNodeDragEnd={(n) => {
            // A dragged drug stays where it was dropped; double-clicking (below) releases it.
            n.fx = n.x;
            n.fy = n.y;
            n.fz = n.z;
          }}
          onNodeRightClick={(n) => {
            n.fx = undefined;
            n.fy = undefined;
            n.fz = undefined;
            fg.current?.d3ReheatSimulation();
          }}
          cooldownTicks={200}
          onEngineStop={() => {
            if (fitted.current) return;
            fitted.current = true;
            fg.current?.zoomToFit(700, 40);
          }}
        />
      )}
    </div>
  );
}
