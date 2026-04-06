import React, { useCallback, useEffect, useRef } from "react";
import type { SpectrumPoint } from "../hooks/useDFData";

const C = { bg: "#060d1a", border: "#0e2a45", cyan: "#00e5ff", green: "#00ff88", muted: "#7a9ab8", text: "#c8dff0" };

type Props = { spectrum: SpectrumPoint[] };

export default function SpectrumChart({ spectrum }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef   = useRef<HTMLDivElement>(null);
  const specRef   = useRef(spectrum);
  specRef.current = spectrum;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const data   = specRef.current;
    if (!canvas || !data.length) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const PAD = { top: 22, right: 18, bottom: 32, left: 48 };
    const pW = W - PAD.left - PAD.right;
    const pH = H - PAD.top - PAD.bottom;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    const minF = data[0].freq, maxF = data[data.length - 1].freq;
    const minD = -115, maxD = -50;
    const fx = (f: number) => PAD.left + ((f - minF) / (maxF - minF)) * pW;
    const fy = (d: number) => PAD.top  + ((maxD - d) / (maxD - minD)) * pH;

    // Grid
    ctx.strokeStyle = "rgba(0,229,255,0.07)";
    ctx.lineWidth = 1;
    for (let db = -110; db <= -55; db += 10) {
      const y = fy(db);
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + pW, y); ctx.stroke();
      ctx.fillStyle = C.muted; ctx.font = "9px monospace"; ctx.textAlign = "right";
      ctx.fillText(`${db}`, PAD.left - 5, y + 3);
    }
    for (let f = 410; f <= maxF; f += 10) {
      const x = fx(f);
      ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, PAD.top + pH); ctx.stroke();
      ctx.fillStyle = C.muted; ctx.font = "9px monospace"; ctx.textAlign = "center";
      ctx.fillText(`${f}`, x, PAD.top + pH + 16);
    }

    // Axis labels
    ctx.fillStyle = C.muted; ctx.font = "9px monospace"; ctx.textAlign = "center";
    ctx.fillText("FREQUENCY (MHz)", PAD.left + pW / 2, H - 3);
    ctx.save(); ctx.translate(12, PAD.top + pH / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText("SIGNAL (dBm)", 0, 0); ctx.restore();

    // Gradient fill
    const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + pH);
    grad.addColorStop(0, "rgba(0,229,255,0.22)");
    grad.addColorStop(1, "rgba(0,229,255,0)");
    ctx.beginPath();
    ctx.moveTo(fx(data[0].freq), fy(data[0].dbm));
    data.forEach(p => ctx.lineTo(fx(p.freq), fy(p.dbm)));
    ctx.lineTo(fx(data[data.length - 1].freq), PAD.top + pH);
    ctx.lineTo(fx(data[0].freq), PAD.top + pH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Neon line
    ctx.shadowColor = C.cyan; ctx.shadowBlur = 7;
    ctx.strokeStyle = C.cyan; ctx.lineWidth = 1.8;
    ctx.beginPath();
    data.forEach((p, i) => i === 0 ? ctx.moveTo(fx(p.freq), fy(p.dbm)) : ctx.lineTo(fx(p.freq), fy(p.dbm)));
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Peak markers + labels
    const peaks = [435.5, 448.2, 462.0, 471.8];
    peaks.forEach(pf => {
      const pt = data.find(s => Math.abs(s.freq - pf) < 0.4);
      if (!pt || pt.dbm < -92) return;
      const x = fx(pt.freq), y = fy(pt.dbm);
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = C.green; ctx.shadowColor = C.green; ctx.shadowBlur = 10; ctx.fill();
      ctx.shadowBlur = 0;
      // Tooltip box
      const label = `${pf} MHz`;
      ctx.font = "bold 9px monospace"; ctx.textAlign = "center";
      const tw = ctx.measureText(label).width + 8;
      ctx.fillStyle = "rgba(0,255,136,0.15)";
      ctx.fillRect(x - tw / 2, y - 22, tw, 14);
      ctx.fillStyle = C.green;
      ctx.fillText(label, x, y - 11);
    });
  }, []);

  // Resize observer — redraws whenever container size changes
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

  // Redraw on new spectrum data
  useEffect(() => { draw(); }, [spectrum, draw]);

  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "8px 14px", borderBottom: `1px solid ${C.border}`, background: "rgba(0,229,255,0.04)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.cyan, boxShadow: `0 0 6px ${C.cyan}` }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: "#e0f7ff", letterSpacing: "0.8px", fontFamily: "'Inter', system-ui, sans-serif" }}>RF SPECTRUM ANALYZER</span>
        <span style={{ marginLeft: "auto", fontSize: 11, fontFamily: "'Inter', system-ui, sans-serif", color: "#8ba3c0", fontWeight: 500 }}>400–500 MHz · LIVE</span>
      </div>
      <div ref={wrapRef} style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />
      </div>
    </div>
  );
}
