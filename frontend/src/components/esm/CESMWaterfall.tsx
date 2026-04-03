import React, { useMemo, useRef, useEffect, useState } from "react";

// ── Colour map: deep navy → cyan (military spectrum palette) ─────────────────
function intensityToRgb(intensity: number, max: number): [number, number, number] {
  const t = Math.min(1, Math.max(0, intensity / max));
  // 0 → deep navy, 0.3 → blue, 0.6 → cyan, 0.85 → bright cyan, 1 → white-cyan
  if (t < 0.15) return [2, 8, 30];
  if (t < 0.35) return [Math.round(t * 60), Math.round(t * 80), Math.round(80 + t * 120)];
  if (t < 0.65) return [0, Math.round(100 + t * 155), Math.round(180 + t * 75)];
  if (t < 0.85) return [0, Math.round(200 + t * 55), 255];
  return [Math.round((t - 0.85) * 6 * 200), 255, 255];
}

export default function CESMWaterfall() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLive, setIsLive] = useState(true);
  const frameRef = useRef(0);
  const offsetRef = useRef(0);

  const COLS = 200;
  const ROWS = 60;

  // Static base data (same logic as original, just more resolution)
  const baseData = useMemo(() => Array.from({ length: ROWS }, (_, t) =>
    Array.from({ length: COLS }, (_, f) => ({
      intensity: Math.random() * 80 + (f === 100 ? 220 : f === 60 ? 140 : 0),
    }))
  ), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cellW = W / COLS;
    const cellH = H / ROWS;
    const maxIntensity = 300;

    function render() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, W, H);

      for (let t = 0; t < ROWS; t++) {
        for (let f = 0; f < COLS; f++) {
          // Add slight time-based shimmer for live feel
          const shimmer = isLive ? Math.random() * 8 : 0;
          const intensity = baseData[t][f].intensity + shimmer;
          const [r, g, b] = intensityToRgb(intensity, maxIntensity);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(
            Math.round(f * cellW),
            Math.round(t * cellH),
            Math.ceil(cellW) + 1,
            Math.ceil(cellH) + 1
          );
        }
      }

      // Scan line overlay for live streaming feel
      if (isLive) {
        const scanY = ((Date.now() / 40) % H);
        const grad = ctx.createLinearGradient(0, scanY - 3, 0, scanY + 3);
        grad.addColorStop(0, "rgba(0,229,255,0)");
        grad.addColorStop(0.5, "rgba(0,229,255,0.12)");
        grad.addColorStop(1, "rgba(0,229,255,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, scanY - 3, W, 6);
      }

      // Frequency marker at peak (col 100)
      ctx.strokeStyle = "rgba(0,229,255,0.5)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(100 * cellW, 0);
      ctx.lineTo(100 * cellW, H);
      ctx.stroke();
      ctx.setLineDash([]);

      if (isLive) {
        frameRef.current = requestAnimationFrame(render);
      }
    }

    render();
    return () => cancelAnimationFrame(frameRef.current);
  }, [baseData, isLive]);

  return (
    <div style={{
      background: "linear-gradient(180deg, #020617 0%, #0B1220 100%)",
      border: "1px solid rgba(0,229,255,0.18)",
      borderRadius: 10,
      overflow: "hidden",
      boxShadow: "0 0 24px rgba(0,229,255,0.06), inset 0 1px 0 rgba(0,229,255,0.08)",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 16px",
        borderBottom: "1px solid rgba(0,229,255,0.1)",
        background: "rgba(0,229,255,0.04)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: isLive ? "#22c55e" : "#64748b",
            boxShadow: isLive ? "0 0 6px #22c55e" : "none",
          }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "#00E5FF", letterSpacing: "1.5px", fontFamily: "monospace" }}>
            WATERFALL DISPLAY
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Colour scale legend */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, fontFamily: "monospace", color: "#475569" }}>
            <span>LOW</span>
            <div style={{
              width: 60, height: 8, borderRadius: 2,
              background: "linear-gradient(90deg, #02081e, #003060, #0080b0, #00c8e0, #00e5ff)",
              border: "1px solid rgba(0,229,255,0.2)",
            }} />
            <span>HIGH</span>
          </div>
          {/* Live toggle */}
          <button
            onClick={() => setIsLive(v => !v)}
            style={{
              padding: "3px 10px", fontSize: 10, fontWeight: 700,
              fontFamily: "monospace", letterSpacing: "0.5px",
              borderRadius: 4, cursor: "pointer",
              border: `1px solid ${isLive ? "#22c55e" : "#334155"}`,
              background: isLive ? "rgba(34,197,94,0.12)" : "rgba(51,65,85,0.3)",
              color: isLive ? "#22c55e" : "#64748b",
              transition: "all 0.2s",
            }}
          >
            {isLive ? "● LIVE" : "○ PAUSED"}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ position: "relative", height: 220 }}>
        <canvas
          ref={canvasRef}
          width={800}
          height={220}
          style={{ width: "100%", height: "100%", display: "block" }}
        />
        {/* Time axis overlay */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          display: "flex", justifyContent: "space-between",
          padding: "2px 8px",
          background: "linear-gradient(0deg, rgba(2,6,23,0.8) 0%, transparent 100%)",
          fontSize: 9, fontFamily: "monospace", color: "#334155",
          pointerEvents: "none",
        }}>
          <span>T-60s</span>
          <span style={{ color: "#475569" }}>TIME →</span>
          <span>NOW</span>
        </div>
      </div>

      {/* Freq axis */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        padding: "4px 8px",
        borderTop: "1px solid rgba(0,229,255,0.08)",
        fontSize: 9, fontFamily: "monospace", color: "#334155",
      }}>
        {["400", "420", "440", "460", "480", "500"].map(f => (
          <span key={f}>{f} MHz</span>
        ))}
      </div>
    </div>
  );
}
