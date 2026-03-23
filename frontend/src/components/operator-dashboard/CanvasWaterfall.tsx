import { useEffect, useRef, useCallback } from "react";

export type WaterfallBin = {
  frequencyHz: number;
  powerDbm: number;
};

interface CanvasWaterfallProps {
  sweep: WaterfallBin[] | null | undefined;
  noiseFloorDbm?: number;
  ceilingDbm?: number;
  maxRows?: number;
  height?: number;
  title?: string;
}

const INTERNAL_COLS = 512;
const MARGIN = { top: 28, right: 72, bottom: 32, left: 52 };

// Jet colormap: maps t ∈ [0, 1] → [R, G, B]
function jetRgb(t: number): [number, number, number] {
  const c = (v: number) => Math.max(0, Math.min(1, v));
  return [
    Math.round(255 * c(1.5 - Math.abs(4 * t - 3))),
    Math.round(255 * c(1.5 - Math.abs(4 * t - 2))),
    Math.round(255 * c(1.5 - Math.abs(4 * t - 1))),
  ];
}

// Pre-compute 256-entry ABGR lookup table (ABGR matches ImageData Uint32 layout on little-endian)
const JET_LUT: Uint32Array = (() => {
  const lut = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    const [r, g, b] = jetRgb(i / 255);
    lut[i] = (0xff << 24) | (b << 16) | (g << 8) | r;
  }
  return lut;
})();

export default function CanvasWaterfall({
  sweep,
  noiseFloorDbm = -110,
  ceilingDbm = -30,
  maxRows = 200,
  height = 320,
  title = "Waterfall History",
}: CanvasWaterfallProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<Float32Array[]>([]);
  const freqRangeRef = useRef({ minHz: 0, maxHz: 1 });
  const rafRef = useRef<number>(0);

  // Mutable prop refs so draw always reads latest values without being in dep array
  const noiseRef = useRef(noiseFloorDbm);
  const ceilRef = useRef(ceilingDbm);
  const maxRowsRef = useRef(maxRows);
  const titleRef = useRef(title);
  noiseRef.current = noiseFloorDbm;
  ceilRef.current = ceilingDbm;
  maxRowsRef.current = maxRows;
  titleRef.current = title;

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const { top, right, bottom, left } = MARGIN;
    const plotW = Math.max(1, W - left - right);
    const plotH = Math.max(1, H - top - bottom);

    const noiseFloor = noiseRef.current;
    const ceiling = ceilRef.current;
    const history = historyRef.current;
    const { minHz, maxHz } = freqRangeRef.current;

    // Background
    ctx.fillStyle = "#090d18";
    ctx.fillRect(0, 0, W, H);

    // ── Waterfall pixel data ───────────────────────────────────────────────
    const imageData = ctx.createImageData(plotW, plotH);
    const pixels = new Uint32Array(imageData.data.buffer);
    const numRows = history.length;

    for (let py = 0; py < plotH; py++) {
      // py=0 → top → oldest sweep; py=plotH-1 → bottom → newest sweep
      const histIdx = Math.floor((py / plotH) * numRows);
      const row = history[histIdx];
      if (!row) continue;

      for (let px = 0; px < plotW; px++) {
        const colF = (px / (plotW - 1)) * (INTERNAL_COLS - 1);
        const colLo = Math.floor(colF);
        const colHi = Math.min(INTERNAL_COLS - 1, colLo + 1);
        const frac = colF - colLo;
        const power = row[colLo] * (1 - frac) + row[colHi] * frac;
        const t = Math.max(0, Math.min(1, (power - noiseFloor) / (ceiling - noiseFloor)));
        pixels[py * plotW + px] = JET_LUT[Math.round(t * 255)];
      }
    }
    ctx.putImageData(imageData, left, top);

    // ── Grid lines ────────────────────────────────────────────────────────
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 0.8;
    const FREQ_TICKS = 7;
    const SWEEP_TICKS = 5;
    for (let i = 0; i <= FREQ_TICKS; i++) {
      const x = left + Math.round((i / FREQ_TICKS) * plotW) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, top + plotH);
      ctx.stroke();
    }
    for (let i = 0; i <= SWEEP_TICKS; i++) {
      const y = top + Math.round((i / SWEEP_TICKS) * plotH) + 0.5;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(left + plotW, y);
      ctx.stroke();
    }

    // ── X-axis frequency labels ───────────────────────────────────────────
    ctx.font = "11px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let i = 0; i <= FREQ_TICKS; i++) {
      const freqHz = minHz + (i / FREQ_TICKS) * (maxHz - minHz);
      const mhz = freqHz / 1_000_000;
      const label = mhz >= 1000 ? `${(mhz / 1000).toFixed(2)} GHz` : `${mhz.toFixed(1)} MHz`;
      const x = left + (i / FREQ_TICKS) * plotW;
      ctx.fillText(label, x, top + plotH + 5);
    }

    // X-axis axis title "Frequency"
    ctx.font = "11px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.textAlign = "center";
    ctx.fillText("Frequency", left + plotW / 2, top + plotH + 20);

    // ── Y-axis sweep labels ───────────────────────────────────────────────
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.font = "10px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    for (let i = 0; i <= SWEEP_TICKS; i++) {
      const y = top + (i / SWEEP_TICKS) * plotH;
      // i=0 → top → oldest (-numRows); i=SWEEP_TICKS → bottom → newest (0)
      const sweepIdx = -Math.round((1 - i / SWEEP_TICKS) * numRows);
      ctx.fillText(`${sweepIdx}`, left - 5, y);
    }

    // Y-axis rotated title "Sweep"
    ctx.save();
    ctx.translate(12, top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "11px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillText("Sweep", 0, 0);
    ctx.restore();

    // ── Colorbar ─────────────────────────────────────────────────────────
    const cbX = left + plotW + 10;
    const cbW = 14;
    for (let row = 0; row < plotH; row++) {
      const t = 1 - row / plotH; // top = ceiling, bottom = noiseFloor
      const [r, g, b] = jetRgb(t);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(cbX, top + row, cbW, 1);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(cbX, top, cbW, plotH);

    // Colorbar labels
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = "10px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    const cbLabelX = cbX + cbW + 4;
    ctx.fillText(`${ceiling} dBm`, cbLabelX, top + 6);
    ctx.fillText(`${Math.round((ceiling + noiseFloor) / 2)} dBm`, cbLabelX, top + plotH / 2);
    ctx.fillText(`${noiseFloor} dBm`, cbLabelX, top + plotH - 4);

    // ── Plot border ───────────────────────────────────────────────────────
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 1;
    ctx.strokeRect(left, top, plotW, plotH);

    // ── Title ─────────────────────────────────────────────────────────────
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 13px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.fillText(titleRef.current, W / 2, top / 2);
  }, []);

  // Resize observer — sync canvas pixel dimensions to container width
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement ?? canvas;

    const resize = () => {
      canvas.width = container.clientWidth || 400;
      canvas.height = height;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(drawCanvas);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => {
      ro.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [drawCanvas, height]);

  // Accept new sweep → interpolate to INTERNAL_COLS grid → push to history
  useEffect(() => {
    if (!sweep || sweep.length === 0) return;

    const sorted = sweep.slice().sort((a, b) => a.frequencyHz - b.frequencyHz);
    const minHz = sorted[0].frequencyHz;
    const maxHz = sorted[sorted.length - 1].frequencyHz;
    freqRangeRef.current = { minHz, maxHz };

    const n = sorted.length;
    const row = new Float32Array(INTERNAL_COLS);
    for (let col = 0; col < INTERNAL_COLS; col++) {
      const targetHz = minHz + (col / (INTERNAL_COLS - 1)) * (maxHz - minHz);
      let lo = 0;
      while (lo < n - 2 && sorted[lo + 1].frequencyHz <= targetHz) lo++;
      const lo0 = sorted[lo];
      const hi0 = sorted[Math.min(lo + 1, n - 1)];
      const span = hi0.frequencyHz - lo0.frequencyHz;
      const frac = span > 0 ? (targetHz - lo0.frequencyHz) / span : 0;
      row[col] = lo0.powerDbm + frac * (hi0.powerDbm - lo0.powerDbm);
    }

    const history = historyRef.current;
    history.push(row);
    if (history.length > maxRowsRef.current) {
      history.splice(0, history.length - maxRowsRef.current);
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(drawCanvas);
  }, [sweep, drawCanvas]);

  return (
    <div style={{ width: "100%", background: "#090d18", borderRadius: 6, overflow: "hidden" }}>
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: `${height}px` }}
      />
    </div>
  );
}
