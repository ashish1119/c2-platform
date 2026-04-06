import React, { useCallback, useEffect, useRef } from "react";
import type { WaterfallRow } from "../hooks/useDFData";

const C = { bg: "#060d1a", border: "#0e2a45", cyan: "#00e5ff", muted: "#7a9ab8" };

function intensityToRgb(v: number): [number, number, number] {
  const t = Math.min(1, Math.max(0, v / 100));
  if (t < 0.18) return [2, 8, 30];
  if (t < 0.42) return [0, Math.round(t * 210), Math.round(70 + t * 210)];
  if (t < 0.72) return [0, Math.round(185 + t * 70), 255];
  return [Math.round((t - 0.72) * 3.6 * 255), 255, 255];
}

type Props = { waterfall: WaterfallRow[] };

export default function WaterfallChart({ waterfall }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef   = useRef<HTMLDivElement>(null);
  const wfRef     = useRef(waterfall);
  wfRef.current   = waterfall;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const data   = wfRef.current;
    if (!canvas || !data.length) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    // Axis padding: left for time labels, bottom for freq labels
    const PAD = { top: 4, right: 8, bottom: 22, left: 44 };
    const pW = W - PAD.left - PAD.right;
    const pH = H - PAD.top - PAD.bottom;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    const rows = Math.min(data.length, 40);
    const cols = data[0].data.length;
    const cellW = pW / cols;
    const cellH = pH / rows;

    // Draw heatmap cells
    for (let r = 0; r < rows; r++) {
      const row = data[r];
      for (let c = 0; c < cols; c++) {
        const [red, g, b] = intensityToRgb(row.data[c]);
        ctx.fillStyle = `rgb(${red},${g},${b})`;
        ctx.fillRect(
          PAD.left + Math.round(c * cellW),
          PAD.top  + Math.round(r * cellH),
          Math.ceil(cellW) + 1,
          Math.ceil(cellH) + 1,
        );
      }
    }

    // Scan-line glow on newest row
    const scanGrad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + cellH * 2.5);
    scanGrad.addColorStop(0, "rgba(0,229,255,0.3)");
    scanGrad.addColorStop(1, "rgba(0,229,255,0)");
    ctx.fillStyle = scanGrad;
    ctx.fillRect(PAD.left, PAD.top, pW, cellH * 2.5);

    // Y-axis: time labels (every ~8 rows)
    ctx.fillStyle = C.muted; ctx.font = "8px monospace"; ctx.textAlign = "right";
    for (let r = 0; r < rows; r += 8) {
      const label = data[r]?.time ?? "";
      const y = PAD.top + r * cellH + cellH / 2 + 3;
      ctx.fillText(label, PAD.left - 4, y);
    }

    // X-axis: freq labels
    ctx.textAlign = "center";
    const freqStart = 400, freqEnd = 500;
    const freqStep = 20;
    for (let f = freqStart; f <= freqEnd; f += freqStep) {
      const x = PAD.left + ((f - freqStart) / (freqEnd - freqStart)) * pW;
      ctx.fillText(`${f}`, x, PAD.top + pH + 15);
      // Tick
      ctx.strokeStyle = "rgba(0,229,255,0.15)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, PAD.top + pH); ctx.stroke();
    }

    // Axis labels
    ctx.fillStyle = C.muted; ctx.font = "9px monospace"; ctx.textAlign = "center";
    ctx.fillText("FREQUENCY (MHz)", PAD.left + pW / 2, H - 2);
    ctx.save(); ctx.translate(10, PAD.top + pH / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText("TIME", 0, 0); ctx.restore();
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width  = wrap.clientWidth;
      canvas.height = wrap.clientHeight;
      draw();
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw]);

  useEffect(() => { draw(); }, [waterfall, draw]);

  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "8px 14px", borderBottom: `1px solid ${C.border}`, background: "rgba(0,229,255,0.04)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e", animation: "dfPulse 1.5s ease-in-out infinite" }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: "#e0f7ff", letterSpacing: "0.8px", fontFamily: "'Inter', system-ui, sans-serif" }}>WATERFALL DISPLAY</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontFamily: "'Inter', system-ui, sans-serif", color: "#8ba3c0", fontWeight: 500 }}>
          <span>LOW</span>
          <div style={{ width: 52, height: 7, borderRadius: 2, background: "linear-gradient(90deg,#02081e,#003060,#00c8e0,#00e5ff,#ffffff)", border: "1px solid rgba(0,229,255,0.2)" }} />
          <span>HIGH</span>
        </div>
      </div>
      <div ref={wrapRef} style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />
      </div>
    </div>
  );
}
