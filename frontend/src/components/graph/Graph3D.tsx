import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D, { type ForceGraphMethods, type LinkObject, type NodeObject } from "react-force-graph-3d";
import * as THREE from "three";
import type { GraphLink, GraphNode } from "@/lib/api";
import { effectOf } from "./effects";

export type Node = NodeObject<GraphNode>;
export type Link = LinkObject<GraphNode, GraphLink & { effect: string; color: string }>;

interface Graph3DProps {
  nodes: GraphNode[];
  links: GraphLink[];
  /** Effect ids to draw; others are hidden. */
  effects: Set<string>;
  selectedNode: string | null;
  selectedLink: Link | null;
  onNodeClick: (n: Node) => void;
  onLinkClick: (l: Link) => void;
  onBackgroundClick: () => void;
}

const SEED = "#3FD0C9";
const NODE = "#9FB3C8";
const DIM = "#2A3542";

const endId = (e: string | number | Node | undefined) => (typeof e === "object" ? (e.id as string) : (e as string));

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

/** A text sprite that always faces the camera, drawn below the node sphere. */
function labelSprite(text: string, color: string, bold: boolean): THREE.Sprite {
  const font = `${bold ? 700 : 500} 44px "Be Vietnam Pro", system-ui, sans-serif`;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 24;
  canvas.width = w;
  canvas.height = 64;
  ctx.font = font;
  ctx.fillStyle = "rgba(10,16,24,0.72)";
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
  return sprite;
}

const radius = (degree: number) => 1.5 + Math.log2(1 + degree) * 0.55;
/** Above this many seeds (the hub view), labels show only on hover or selection. */
const LABEL_ALL_SEEDS = 12;

/** Force-directed 3D view: spheres are drugs (sized by how many drugs they interact with), lines are interactions. */
export function Graph3D({ nodes, links, effects, selectedNode, selectedLink, onNodeClick, onLinkClick, onBackgroundClick }: Graph3DProps) {
  const [boxRef, size] = useSize();
  const fg = useRef<ForceGraphMethods<Node, Link>>(undefined);
  const [hover, setHover] = useState<string | null>(null);

  // A fresh object per response: the force engine mutates nodes and links in place.
  const data = useMemo(() => {
    const ls = links.map((l) => {
      const e = effectOf(l.condition);
      return { ...l, effect: e.id, color: e.color };
    });
    return { nodes: nodes.map((n) => ({ ...n })) as Node[], links: ls as Link[] };
  }, [nodes, links]);

  const labelSeeds = useMemo(() => nodes.filter((n) => n.seed).length <= LABEL_ALL_SEEDS, [nodes]);
  const shown = useMemo(() => ({ nodes: data.nodes, links: data.links.filter((l) => effects.has(l.effect)) }), [data, effects]);

  // Hovering or selecting a drug highlights it and its direct partners; everything else fades.
  const focus = hover ?? selectedNode;
  const near = useMemo(() => {
    if (!focus) return null;
    const s = new Set([focus]);
    for (const l of shown.links) {
      const a = endId(l.source);
      const b = endId(l.target);
      if (a === focus) s.add(b);
      if (b === focus) s.add(a);
    }
    return s;
  }, [focus, shown.links]);

  const linkLit = (l: Link) => {
    if (selectedLink) return l === selectedLink;
    return !focus || endId(l.source) === focus || endId(l.target) === focus;
  };

  useEffect(() => {
    const g = fg.current;
    if (!g) return;
    g.d3Force("charge")?.strength(-140);
    g.d3Force("link")?.distance(60);
  }, [data]);

  // Zoom to fit once the layout settles after new data arrives.
  const fitted = useRef(false);
  useEffect(() => {
    fitted.current = false;
  }, [data]);

  return (
    <div ref={boxRef} className="absolute inset-0">
      {size.w > 0 && (
        <ForceGraph3D<GraphNode, GraphLink & { effect: string; color: string }>
          ref={fg}
          width={size.w}
          height={size.h}
          graphData={shown}
          backgroundColor="#0B1118"
          showNavInfo={false}
          nodeId="id"
          nodeVal={(n) => radius(n.degree) ** 3}
          nodeRelSize={1}
          nodeResolution={16}
          nodeOpacity={0.95}
          nodeColor={(n) => (near && !near.has(n.id) ? DIM : n.seed && labelSeeds ? SEED : NODE)}
          nodeLabel={(n) => `<b>${n.id}</b><br/>${n.degree.toLocaleString("vi-VN")} tương tác trong CSDL`}
          nodeThreeObjectExtend
          nodeThreeObject={(n) => {
            const always = (n.seed && labelSeeds) || n.id === selectedNode;
            if (!always && !near?.has(n.id)) return new THREE.Object3D();
            const s = labelSprite(n.id, n.seed ? SEED : "#E6EDF3", n.seed);
            s.position.y = -(radius(n.degree) + 4);
            return s;
          }}
          linkColor={(l) => (linkLit(l) ? l.color : DIM)}
          linkOpacity={0.55}
          linkWidth={(l) => (l === selectedLink ? 1.6 : linkLit(l) && focus ? 0.8 : 0.25)}
          linkDirectionalArrowLength={(l) => (linkLit(l) && (focus || selectedLink) ? 4 : 0)}
          linkDirectionalArrowRelPos={0.92}
          linkDirectionalArrowColor={(l) => l.color}
          linkDirectionalParticles={(l) => (l === selectedLink ? 4 : 0)}
          linkDirectionalParticleWidth={1.8}
          linkDirectionalParticleColor={(l) => l.color}
          linkLabel={(l) => l.condition}
          onNodeHover={(n) => setHover(n ? (n.id as string) : null)}
          onNodeClick={(n) => {
            const dist = 120;
            const { x = 0, y = 0, z = 0 } = n;
            const r = Math.hypot(x, y, z) || 1;
            fg.current?.cameraPosition({ x: x * (1 + dist / r), y: y * (1 + dist / r), z: z * (1 + dist / r) }, { x, y, z }, 900);
            onNodeClick(n);
          }}
          onLinkClick={onLinkClick}
          onBackgroundClick={onBackgroundClick}
          cooldownTicks={160}
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
