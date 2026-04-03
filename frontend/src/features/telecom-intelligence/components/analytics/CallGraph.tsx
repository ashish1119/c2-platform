/**
 * CallGraph — Interactive call relationship graph rendered on HTML Canvas.
 *
 * Pure implementation — no vis-network or react-force-graph dependency.
 * Uses a simple force-directed layout (repulsion + spring) computed in a
 * requestAnimationFrame loop.
 *
 * Features:
 *  - Centre node (blue, large) + contact nodes (red/amber for suspicious)
 *  - Edge thickness proportional to call count
 *  - Edge colour: normal=blue, high-freq=dark-blue, suspicious=red
 *  - Call count label on each edge
 *  - Zoom + pan (mouse wheel + drag)
 *  - Click node → select (fires onNodeSelect)
 *  - Hover highlight
 *  - Pulse animation on suspicious nodes
 *  - showLabels / showSuspiciousOnly toggles
 *  - Fit-to-screen, zoom in/out, reset layout
 */
import React, {
  useCallback, useEffect, useMemo, useRef, useState, useImperativeHandle, forwardRef,
} from "react";
import type { GraphNode, GraphLink } from "../../state/useGraphData";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LayoutNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export interface CallGraphHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
  resetLayout: () => void;
}

type Props = {
  nodes: GraphNode[];
  links: GraphLink[];
  selectedNodeId: string | null;
  onNodeSelect: (node: GraphNode | null) => void;
  /** Called when user double-clicks a contact node to make it the new center */
  onExpandNode?: (msisdn: string) => void;
  showLabels: boolean;
  showSuspiciousOnly: boolean;
  isDark: boolean;
  width?: number;
  height?: number;
  /** ID of the most-connected node — rendered with gold centrality glow */
  centralNodeId?: string | null;
  /** Current center MSISDN — used to highlight the active focus node */
  centerMsisdn?: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function nodeRadius(n: GraphNode): number {
  if (n.type === "main") return 28;
  const base = 14 + Math.min(n.total_calls * 1.5, 12);
  return base;
}

function nodeColor(n: GraphNode, selected: boolean, hovered: boolean): string {
  if (selected) return "#11C1CA";
  if (hovered) return "#e2e8f0";
  if (n.type === "main") return "#3b82f6";
  if (n.suspicious) return "#f59e0b";
  return "#ef4444";
}

function edgeColor(l: GraphLink): string {
  if (l.suspicious) return "#ef4444";
  if (l.weight > 0.7) return "#1d4ed8";
  if (l.weight > 0.4) return "#3b82f6";
  return "#93c5fd";
}

function edgeWidth(l: GraphLink): number {
  return 1 + l.weight * 5;
}

// ── Force layout ──────────────────────────────────────────────────────────────

function initLayout(
  nodes: GraphNode[],
  w: number,
  h: number,
  existingPositions?: Map<string, { x: number; y: number }>,
): LayoutNode[] {
  const cx = w / 2, cy = h / 2;
  return nodes.map((n, i) => {
    // Reuse existing position if available (preserves layout on merge)
    const existing = existingPositions?.get(n.id);
    if (existing) {
      return { ...n, x: existing.x, y: existing.y, vx: 0, vy: 0, radius: nodeRadius(n) };
    }
    if (n.type === "main") return { ...n, x: cx, y: cy, vx: 0, vy: 0, radius: nodeRadius(n) };
    const angle = (i / Math.max(nodes.length - 1, 1)) * Math.PI * 2;
    const r = Math.min(w, h) * 0.32;
    return { ...n, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), vx: 0, vy: 0, radius: nodeRadius(n) };
  });
}

function tickForce(layout: LayoutNode[], links: GraphLink[], w: number, h: number): LayoutNode[] {
  const REPULSION = 3500;
  const SPRING_LEN = 160;
  const SPRING_K = 0.04;
  const DAMPING = 0.85;
  const CENTRE_K = 0.008;
  const cx = w / 2, cy = h / 2;

  const next = layout.map((n) => ({ ...n }));

  // Repulsion between all pairs
  for (let i = 0; i < next.length; i++) {
    for (let j = i + 1; j < next.length; j++) {
      const dx = next[i].x - next[j].x;
      const dy = next[i].y - next[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = REPULSION / (dist * dist);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      next[i].vx += fx; next[i].vy += fy;
      next[j].vx -= fx; next[j].vy -= fy;
    }
  }

  // Spring forces along links
  const idxMap = new Map(next.map((n, i) => [n.id, i]));
  for (const l of links) {
    const si = idxMap.get(l.source), ti = idxMap.get(l.target);
    if (si === undefined || ti === undefined) continue;
    const dx = next[ti].x - next[si].x;
    const dy = next[ti].y - next[si].y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const stretch = dist - SPRING_LEN;
    const fx = (dx / dist) * stretch * SPRING_K;
    const fy = (dy / dist) * stretch * SPRING_K;
    next[si].vx += fx; next[si].vy += fy;
    next[ti].vx -= fx; next[ti].vy -= fy;
  }

  // Centre gravity
  for (const n of next) {
    if (n.type === "main") continue;
    n.vx += (cx - n.x) * CENTRE_K;
    n.vy += (cy - n.y) * CENTRE_K;
  }

  // Integrate + damp + clamp
  for (const n of next) {
    if (n.type === "main") { n.vx = 0; n.vy = 0; continue; }
    n.vx *= DAMPING; n.vy *= DAMPING;
    n.x += n.vx; n.y += n.vy;
    n.x = Math.max(n.radius + 4, Math.min(w - n.radius - 4, n.x));
    n.y = Math.max(n.radius + 4, Math.min(h - n.radius - 4, n.y));
  }

  return next;
}

// ── Component ─────────────────────────────────────────────────────────────────

const CallGraph = forwardRef<CallGraphHandle, Props>(function CallGraph(
  { nodes, links, selectedNodeId, onNodeSelect, onExpandNode, showLabels, showSuspiciousOnly, isDark, width = 700, height = 520, centralNodeId, centerMsisdn }: Props,
  ref: React.ForwardedRef<CallGraphHandle>,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layoutRef = useRef<LayoutNode[]>([]);
  const rafRef = useRef<number>(0);
  const tickRef = useRef(0);

  // Pan + zoom state
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const dragRef = useRef<{ startX: number; startY: number; tx: number; ty: number } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hoveredRef = useRef<string | null>(null);

  // Single-click timer for expand vs select disambiguation
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pulse tick for suspicious nodes
  const pulseRef = useRef(0);

  // Filter nodes/links
  const visibleNodes = useMemo(
    () => showSuspiciousOnly ? nodes.filter((n: GraphNode) => n.suspicious || n.type === "main") : nodes,
    [nodes, showSuspiciousOnly]
  );
  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n: GraphNode) => n.id)), [visibleNodes]);
  const visibleLinks = useMemo(
    () => links.filter((l: GraphLink) => visibleNodeIds.has(l.source) && visibleNodeIds.has(l.target)),
    [links, visibleNodeIds]
  );

  // Re-init layout when nodes change — preserve existing positions for old nodes
  useEffect(() => {
    // Snapshot current positions before re-init so merged nodes stay put
    const existingPositions = new Map<string, { x: number; y: number }>();
    layoutRef.current.forEach((n: LayoutNode) => {
      existingPositions.set(n.id, { x: n.x, y: n.y });
    });
    layoutRef.current = initLayout(visibleNodes, width, height, existingPositions);
    // Only reset tick counter for truly new layouts (no existing positions)
    if (existingPositions.size === 0) tickRef.current = 0;
    else tickRef.current = 0; // still re-run forces so new nodes settle
  }, [visibleNodes, width, height]);

  // ── Draw ──────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x: tx, y: ty, scale } = transformRef.current;
    pulseRef.current += 0.06;

    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = isDark ? "#0f172a" : "#f8fafc";
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(scale, scale);

    const layout = layoutRef.current;
    const idxMap = new Map(layout.map((n: LayoutNode, i: number) => [n.id, i]));

    // ── Draw edges ──────────────────────────────────────────────────────────
    for (const l of visibleLinks) {
      const si = idxMap.get(l.source), ti = idxMap.get(l.target);
      if (si === undefined || ti === undefined) continue;
      const src = layout[si], tgt = layout[ti];

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.strokeStyle = edgeColor(l);
      ctx.lineWidth = edgeWidth(l);
      ctx.globalAlpha = 0.7;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Arrow at 65% along edge
      const ax = src.x + (tgt.x - src.x) * 0.65;
      const ay = src.y + (tgt.y - src.y) * 0.65;
      const angle = Math.atan2(tgt.y - src.y, tgt.x - src.x);
      const arrowSize = 7;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - arrowSize * Math.cos(angle - 0.4), ay - arrowSize * Math.sin(angle - 0.4));
      ctx.lineTo(ax - arrowSize * Math.cos(angle + 0.4), ay - arrowSize * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fillStyle = edgeColor(l);
      ctx.globalAlpha = 0.8;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Call count label
      if (showLabels && l.count > 0) {
        const mx = (src.x + tgt.x) / 2;
        const my = (src.y + tgt.y) / 2;
        ctx.font = "bold 10px monospace";
        ctx.fillStyle = isDark ? "#e2e8f0" : "#1e293b";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const label = `${l.count}`;
        const tw = ctx.measureText(label).width + 6;
        ctx.fillStyle = isDark ? "rgba(15,23,42,0.8)" : "rgba(255,255,255,0.85)";
        ctx.fillRect(mx - tw / 2, my - 8, tw, 16);
        ctx.fillStyle = edgeColor(l);
        ctx.fillText(label, mx, my);
      }
    }

    // ── Draw nodes ──────────────────────────────────────────────────────────
    for (const n of layout) {
      const isSelected = n.id === selectedNodeId;
      const isHovered = n.id === hoveredRef.current;
      const isFocusCenter = centerMsisdn ? n.id === centerMsisdn : n.type === "main";
      // Fade non-focus, non-main nodes slightly when a center is active
      const isOldNode = centerMsisdn && n.id !== centerMsisdn && n.type !== "main";
      const color = nodeColor(n, isSelected, isHovered);
      const r = n.radius;

      // Fade older nodes (not the current focus center)
      if (isOldNode) ctx.globalAlpha = 0.55;

      // Pulse glow for suspicious nodes
      if (n.suspicious) {
        const pulse = 0.3 + 0.25 * Math.sin(pulseRef.current);
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245,158,11,${pulse})`;
        ctx.fill();
      }

      // Centrality glow — most-connected node gets a gold ring
      if (centralNodeId && n.id === centralNodeId) {
        const pulse = 0.4 + 0.3 * Math.sin(pulseRef.current * 0.8);
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 12, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(250,204,21,${pulse})`;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(250,204,21,${pulse * 0.4})`;
        ctx.fill();
      }

      // Current focus center — cyan outer ring
      if (isFocusCenter && centerMsisdn) {
        const pulse = 0.5 + 0.3 * Math.sin(pulseRef.current * 1.2);
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 9, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0,229,255,${pulse})`;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Selection ring
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 5, 0, Math.PI * 2);
        ctx.strokeStyle = "#11C1CA";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(n.x - r * 0.3, n.y - r * 0.3, r * 0.1, n.x, n.y, r);
      grad.addColorStop(0, lighten(color, 0.3));
      grad.addColorStop(1, color);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = "white";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Reset alpha after drawing faded node
      ctx.globalAlpha = 1;

      // Node label
      if (showLabels || n.type === "main") {
        const short = n.label.length > 13 ? n.label.slice(-10) : n.label;
        ctx.font = n.type === "main" ? "bold 11px sans-serif" : "10px sans-serif";
        ctx.fillStyle = isDark ? "#f1f5f9" : "#1e293b";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(short, n.x, n.y + r + 4);
      }

      // Call count inside node
      if (n.total_calls > 0) {
        ctx.font = `bold ${n.type === "main" ? 12 : 10}px monospace`;
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(n.total_calls > 99 ? "99+" : n.total_calls), n.x, n.y);
      }

      // Expand hint: show "⊕" above hovered contact nodes when onExpandNode is available
      if (onExpandNode && n.type === "contact" && isHovered) {
        ctx.font = "bold 13px sans-serif";
        ctx.fillStyle = "#00E5FF";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText("⊕", n.x, n.y - r - 2);
      }
    }

    ctx.restore();
  }, [visibleLinks, selectedNodeId, showLabels, isDark, width, height]);

  // ── Animation loop ────────────────────────────────────────────────────────
  useEffect(() => {
    const MAX_TICKS = 200;
    function loop() {
      if (tickRef.current < MAX_TICKS) {
        layoutRef.current = tickForce(layoutRef.current, visibleLinks, width, height);
        tickRef.current++;
      }
      draw();
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw, visibleLinks, width, height]);

  // ── Hit test ──────────────────────────────────────────────────────────────
  const hitTest = useCallback((cx: number, cy: number): LayoutNode | null => {
    const { x: tx, y: ty, scale } = transformRef.current;
    const wx = (cx - tx) / scale;
    const wy = (cy - ty) / scale;
    for (const n of layoutRef.current) {
      const dx = n.x - wx, dy = n.y - wy;
      if (Math.sqrt(dx * dx + dy * dy) <= n.radius + 4) return n;
    }
    return null;
  }, []);

  // ── Mouse events ──────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;

    if (dragRef.current) {
      const dx = cx - dragRef.current.startX;
      const dy = cy - dragRef.current.startY;
      const next = { ...transformRef.current, x: dragRef.current.tx + dx, y: dragRef.current.ty + dy };
      transformRef.current = next;
      setTransform(next);
      return;
    }

    const hit = hitTest(cx, cy);
    const id = hit?.id ?? null;
    if (id !== hoveredRef.current) {
      hoveredRef.current = id;
      setHoveredId(id);
      if (canvasRef.current) canvasRef.current.style.cursor = id ? "pointer" : "grab";
    }
  }, [hitTest]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    const hit = hitTest(cx, cy);
    if (!hit) {
      dragRef.current = { startX: cx, startY: cy, tx: transformRef.current.x, ty: transformRef.current.y };
    }
  }, [hitTest]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (dragRef.current) { dragRef.current = null; return; }
    const rect = canvasRef.current!.getBoundingClientRect();
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    const hit = hitTest(cx, cy);

    // Clear any pending click timer
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }

    if (hit && hit.type === "contact" && onExpandNode) {
      // Single click on contact node → expand graph (tree grows)
      onExpandNode(hit.id);
      // Also select the node so sidebar shows details
      onNodeSelect(hit);
    } else {
      // Click on main node or empty space → just select/deselect
      onNodeSelect(hit ?? null);
    }
  }, [hitTest, onNodeSelect, onExpandNode]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.88;
    const next = { ...transformRef.current, scale: Math.max(0.2, Math.min(4, transformRef.current.scale * factor)) };
    transformRef.current = next;
    setTransform(next);
  }, []);

  // ── Imperative handle ─────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      const next = { ...transformRef.current, scale: Math.min(4, transformRef.current.scale * 1.2) };
      transformRef.current = next; setTransform(next);
    },
    zoomOut: () => {
      const next = { ...transformRef.current, scale: Math.max(0.2, transformRef.current.scale * 0.8) };
      transformRef.current = next; setTransform(next);
    },
    fit: () => {
      const next = { x: 0, y: 0, scale: 1 };
      transformRef.current = next; setTransform(next);
    },
    resetLayout: () => {
      layoutRef.current = initLayout(visibleNodes, width, height);
      tickRef.current = 0;
    },
  }), [visibleNodes, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: "block", borderRadius: 10, cursor: "grab", touchAction: "none" }}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { dragRef.current = null; hoveredRef.current = null; setHoveredId(null); }}
      onWheel={handleWheel}
    />
  );
});

export default CallGraph;

// ── Colour helper ─────────────────────────────────────────────────────────────
function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, (num >> 16) + Math.round(255 * amount));
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * amount));
  const b = Math.min(255, (num & 0xff) + Math.round(255 * amount));
  return `rgb(${r},${g},${b})`;
}
