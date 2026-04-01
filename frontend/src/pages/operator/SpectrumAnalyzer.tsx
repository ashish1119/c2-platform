// Simulated Frequency-vs-Power spectrum + Waterfall / spectrogram.

import { useRef, useEffect, useCallback, useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// Props
// ═══════════════════════════════════════════════════════════════════════════

export interface SpectrumAnalyzerProps {
  onClose?: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════

const FREQ_MIN = 2;
const FREQ_MAX = 18;
const NUM_PTS  = 1024;   // high point count for fine-grained noise
const WF_ROWS  = 160;

const FREQ_TICKS = [2, 4, 6, 8, 10, 12, 14, 16, 18];
const DBM_TICKS  = [-40, -60, -80, -100, -120];

const CW = 1800;
const SH = 360;
const WH = 320;

const LEN_OPTIONS = [
  "32768-610 Hz-1.6384 ms",
  "16384-1221 Hz-0.8192 ms",
  "65536-305 Hz-3.2768 ms",
  "8192-2441 Hz-0.4096 ms",
];

// ═══════════════════════════════════════════════════════════════════════════
// Noise helpers  — layered noise at different scales for a realistic RF look
// ═══════════════════════════════════════════════════════════════════════════

/** Interpolated band-limited noise at a given coarseness. */
function bandNoise(pts: number, coarse: number, amp: number): number[] {
  const n = Math.ceil(pts / coarse) + 2;
  const seeds: number[] = [];
  for (let i = 0; i < n; i++) seeds.push((Math.random() - 0.5) * 2);
  const out: number[] = [];
  for (let i = 0; i < pts; i++) {
    const p = i / coarse;
    const k = Math.floor(p);
    const f = p - k;
    // cubic-ish interpolation for smoother contour
    const t = f * f * (3 - 2 * f);
    out.push(((seeds[k] ?? 0) * (1 - t) + (seeds[k + 1] ?? 0) * t) * amp);
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// Spectrum sweep generation — layered noise + signal model
// ═══════════════════════════════════════════════════════════════════════════
function genSpectrum(): number[] {
  // noise octaves — coarse shapes + fine grain
  const n1 = bandNoise(NUM_PTS, 128, 2.5);   // very slow undulation
  const n2 = bandNoise(NUM_PTS,  48, 2.0);   // medium drift
  const n3 = bandNoise(NUM_PTS,  12, 1.8);   // fast ripple
  const n4 = bandNoise(NUM_PTS,   4, 1.2);   // fine grain
  // per-point random "speckle" — the most visible jitter
  const d: number[] = [];
  for (let i = 0; i < NUM_PTS; i++) {
    const f = FREQ_MIN + (i / (NUM_PTS - 1)) * (FREQ_MAX - FREQ_MIN);

    // ── noise floor ──
    let p = -120
          + n1[i] + n2[i] + n3[i] + n4[i]
          + (Math.random() - 0.5) * 3.5;     // raw speckle

    // ── raised noise floor in 4-8 MHz region (broader activity) ──
    const actBand = Math.exp(-((f - 6) ** 2) / 6);
    p += actBand * (5 + (Math.random() - 0.5) * 4);
    // occasional spikes in the active band
    if (actBand > 0.3 && Math.random() < 0.06) {
      p += 4 + Math.random() * 8;
    }

    // ── main peak ~10 MHz — sharp Lorentzian ──
    const peakCore = 38 / (1 + ((f - 10) / 0.12) ** 2);
    // skirts / shoulders with their own jitter
    const peakWide = 10 / (1 + ((f - 10) / 0.6) ** 2);
    const peakNoise = peakCore > 1 ? (Math.random() - 0.5) * 2.5 * Math.sqrt(peakCore / 10) : 0;
    p += peakCore + peakWide + peakNoise;

    // ── secondary features ──
    p += 3.5 * Math.exp(-((f - 3.5) ** 2) / 0.35);
    p += 2   * Math.exp(-((f - 13.5) ** 2) / 0.8);
    p += 1.5 * Math.exp(-((f - 15) ** 2) / 0.5);

    // ── slight edge roll-off ──
    if (f < 2.5) p -= (2.5 - f) * 3;
    if (f > 17.5) p -= (f - 17.5) * 3;

    d.push(p);
  }
  return d;
}

/**
 * Light EMA smooth — blends only 20% of the new sweep so the trace
 * still looks noisy but the overall shape doesn't teleport between frames.
 */
function emaSmooth(prev: number[], raw: number[], alpha: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    out.push(prev[i] * (1 - alpha) + raw[i] * alpha);
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// Colour ramp  (blue → cyan → green → yellow → red)
// ═══════════════════════════════════════════════════════════════════════════

function pw2rgb(
  power: number,
  dBmMin: number,
  dBmMax: number,
): [number, number, number] {
  const t = Math.max(0, Math.min(1, (power - dBmMin) / (dBmMax - dBmMin)));
  const stops: [number, number, number][] = [
    [0,   0,   80],
    [0,  40,  200],
    [0, 180,  255],
    [0, 255,  100],
    [255, 255,  0],
    [255,  80,  0],
    [255,   0,  0],
  ];
  const seg = t * (stops.length - 1);
  const idx = Math.min(Math.floor(seg), stops.length - 2);
  const fr  = seg - idx;
  return [
    Math.round(stops[idx][0] + (stops[idx + 1][0] - stops[idx][0]) * fr),
    Math.round(stops[idx][1] + (stops[idx + 1][1] - stops[idx][1]) * fr),
    Math.round(stops[idx][2] + (stops[idx + 1][2] - stops[idx][2]) * fr),
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// Draw spectrum (top canvas)
// ═══════════════════════════════════════════════════════════════════════════

function drawSpec(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  data: number[],
  dBmMin: number,
  dBmMax: number,
) {
  const ml = 50, mr = 50, mt = 8, mb = 4;
  const pw = w - ml - mr;
  const ph = h - mt - mb;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);

  // horizontal grid
  ctx.strokeStyle = "rgba(131, 158, 21, 0.5)";
  ctx.lineWidth   = 0.7;
  ctx.font        = "bold 13px Segoe UI, sans-serif";
  for (const dBm of DBM_TICKS) {
    if (dBm < dBmMin || dBm > dBmMax) continue;
    const y = mt + ph * (1 - (dBm - dBmMin) / (dBmMax - dBmMin));
    ctx.beginPath();
    ctx.moveTo(ml, y);
    ctx.lineTo(w - mr, y);
    ctx.stroke();
    ctx.fillStyle = "#bbb";
    ctx.textAlign = "right";
    ctx.fillText(`${dBm}`, ml - 7, y + 5);
    ctx.textAlign = "left";
    ctx.fillText(`${dBm}`, w - mr + 7, y + 5);
  }

  // "dBm" badge
  ctx.fillStyle = "#fff";
  ctx.font      = "bold 14px Segoe UI, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("dBm", ml + 8, mt + 20);

  // timestamp
  const now = new Date();
  const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const ts  = `${DAY[now.getDay()]} ${MON[now.getMonth()]} ${
    String(now.getDate()).padStart(2, "0")
  } ${now.toLocaleTimeString("en-GB")} ${now.getFullYear()}`;
  ctx.fillStyle = "#ffcc00";
  ctx.font      = "bold 14px Segoe UI, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(ts, w - mr - 8, mt + 20);

  // trace — glow pass (wide soft yellow halo)
  ctx.save();
  ctx.shadowColor = "rgba(255,255,0,0.6)";
  ctx.shadowBlur  = 10;
  ctx.beginPath();
  ctx.strokeStyle = "rgba(200,200,0,0.35)";
  ctx.lineWidth   = 4;
  for (let i = 0; i < data.length; i++) {
    const x = ml + (i / (data.length - 1)) * pw;
    const v = Math.max(dBmMin, Math.min(dBmMax, data[i]));
    const y = mt + ph * (1 - (v - dBmMin) / (dBmMax - dBmMin));
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();

  // trace — bright solid pass
  ctx.beginPath();
  ctx.strokeStyle = "#ffff00";
  ctx.lineWidth   = 1.8;
  for (let i = 0; i < data.length; i++) {
    const x = ml + (i / (data.length - 1)) * pw;
    const v = Math.max(dBmMin, Math.min(dBmMax, data[i]));
    const y = mt + ph * (1 - (v - dBmMin) / (dBmMax - dBmMin));
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();

  // trace — thin white highlight on top for extra brightness
  ctx.beginPath();
  ctx.strokeStyle = "rgba(255,255,200,0.25)";
  ctx.lineWidth   = 0.8;
  for (let i = 0; i < data.length; i++) {
    const x = ml + (i / (data.length - 1)) * pw;
    const v = Math.max(dBmMin, Math.min(dBmMax, data[i]));
    const y = mt + ph * (1 - (v - dBmMin) / (dBmMax - dBmMin));
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
}

// ═══════════════════════════════════════════════════════════════════════════
// Draw waterfall (bottom canvas)
// ═══════════════════════════════════════════════════════════════════════════

function drawWF(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rows: number[][],
  dBmMin: number,
  dBmMax: number,
) {
  const ml = 50, mr = 50, mt = 6, mb = 4;
  const pw = w - ml - mr;
  const ph = h - mt - mb;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);

  // pixel buffer
  const img = ctx.createImageData(pw, ph);
  const buf = img.data;
  for (let py = 0; py < ph; py++) {
    const ri = Math.min(Math.floor((py / ph) * rows.length), rows.length - 1);
    const d  = rows[ri];
    if (!d) continue;
    for (let px = 0; px < pw; px++) {
      const di = Math.min(Math.floor((px / pw) * d.length), d.length - 1);
      const [r, g, b] = pw2rgb(d[di], dBmMin, dBmMax);
      const off = (py * pw + px) * 4;
      buf[off] = r; buf[off + 1] = g; buf[off + 2] = b; buf[off + 3] = 255;
    }
  }
  ctx.putImageData(img, ml, mt);

  // dBm side labels
  ctx.font      = "bold 12px Segoe UI, sans-serif";
  ctx.fillStyle = "#bbb";
  for (const dBm of DBM_TICKS) {
    if (dBm < dBmMin || dBm > dBmMax) continue;
    const y = mt + ph * (1 - (dBm - dBmMin) / (dBmMax - dBmMin));
    ctx.textAlign = "right";
    ctx.fillText(`${dBm}`, ml - 7, y + 4);
    ctx.textAlign = "left";
    ctx.fillText(`${dBm}`, w - mr + 7, y + 4);
  }

  // time labels (green on dark badge)
  const now = new Date();
  ctx.font = "bold 12px Segoe UI, sans-serif";
  for (let i = 0; i < 3; i++) {
    const t   = new Date(now.getTime() - i * 5000);
    const lbl = t.toLocaleTimeString("en-GB");
    const y   = mt + ((i * 2 + 1) / 6) * ph;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(ml + 4, y - 12, 68, 17);
    ctx.fillStyle = "#00ff00";
    ctx.textAlign = "left";
    ctx.fillText(lbl, ml + 6, y);
  }

  // colour scale bar (right edge)
  const barW = 14;
  const barX = w - mr + 26;
  for (let py = 0; py < ph; py++) {
    const pwr = dBmMax - (py / ph) * (dBmMax - dBmMin);
    const [r, g, b] = pw2rgb(pwr, dBmMin, dBmMax);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(barX, mt + py, barW, 2);
  }
  // scale bar dBm labels
  ctx.font      = "10px Segoe UI, sans-serif";
  ctx.fillStyle = "#aaa";
  ctx.textAlign = "left";
  for (const dBm of DBM_TICKS) {
    if (dBm < dBmMin || dBm > dBmMax) continue;
    const y = mt + ph * (1 - (dBm - dBmMin) / (dBmMax - dBmMin));
    ctx.fillText(`${dBm}`, barX + barW + 3, y + 4);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Spinner sub-component (▲▼ buttons)
// ═══════════════════════════════════════════════════════════════════════════

const spinBtnCss: React.CSSProperties = {
  display:        "inline-flex",
  alignItems:     "center",
  justifyContent: "center",
  width:          14,
  height:         12,
  border:         "1px solid #aaa",
  borderRadius:   1,
  background:     "#f4f4f4",
  color:          "#333",
  cursor:         "pointer",
  fontSize:       7,
  fontWeight:     700,
  lineHeight:     1,
  padding:        0,
};

function Spinner({
  value,
  onUp,
  onDown,
  label,
}: {
  value: number | string;
  onUp: () => void;
  onDown: () => void;
  label: string;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}>
      <span>{label}</span>
      <b style={{ minWidth: 18 }}>{value}</b>
      <span style={{ display: "inline-flex", flexDirection: "column", gap: 0, marginLeft: 1 }}>
        <button onClick={onUp}   style={spinBtnCss} title="Increase">▲</button>
        <button onClick={onDown} style={spinBtnCss} title="Decrease">▼</button>
      </span>
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main React component
// ═══════════════════════════════════════════════════════════════════════════

export default function SpectrumAnalyzer({ onClose }: SpectrumAnalyzerProps) {
  // ── control state ──────────────────────────────────────────────────────
  const [avg, setAvg]             = useState(4);
  const [lenIdx, setLenIdx]       = useState(0);
  const [refresh, setRefresh]     = useState(8);
  const [dBmMax, setDBmMax]       = useState(-33);
  const [dBmMin, setDBmMin]       = useState(-135);
  const [autoScale, setAutoScale] = useState(true);
  const [running, setRunning]     = useState(true);

  // ── canvas refs ────────────────────────────────────────────────────────
  const specRef = useRef<HTMLCanvasElement>(null);
  const wfRef   = useRef<HTMLCanvasElement>(null);
  const curData = useRef<number[]>(genSpectrum());
  const wfRows  = useRef<number[][]>([]);
  const avgBuf  = useRef<number[][]>([]);

  // keep latest state in a ref for the rAF loop
  const stateRef = useRef({ avg, refresh, dBmMax, dBmMin, autoScale, running });
  stateRef.current = { avg, refresh, dBmMax, dBmMin, autoScale, running };

  // ── draw callback ─────────────────────────────────────────────────────
  const redraw = useCallback(() => {
    const { dBmMax: mx, dBmMin: mn } = stateRef.current;
    const sc = specRef.current;
    const wc = wfRef.current;
    if (sc) {
      const ctx = sc.getContext("2d");
      if (ctx) drawSpec(ctx, CW, SH, curData.current, mn, mx);
    }
    if (wc) {
      const ctx = wc.getContext("2d");
      if (ctx) drawWF(ctx, CW, WH, wfRows.current, mn, mx);
    }
  }, []);

  // ── animation loop ─────────────────────────────────────────────────────
  useEffect(() => {
    // seed waterfall history
    const rows: number[][] = [];
    for (let i = 0; i < WF_ROWS; i++) rows.push(genSpectrum());
    wfRows.current = rows;
    avgBuf.current = [genSpectrum()];

    let lastTime = 0;
    let frameId  = 0;

    const loop = (time: number) => {
      frameId = requestAnimationFrame(loop);
      const st = stateRef.current;
      if (!st.running) return;
      const interval = Math.max(33, 1000 / st.refresh);
      if (time - lastTime < interval) return;
      lastTime = time;

      const raw = genSpectrum();

      // averaging buffer
      avgBuf.current.push(raw);
      if (avgBuf.current.length > st.avg) avgBuf.current.shift();

      // compute averaged sweep
      const sweep: number[] = [];
      for (let i = 0; i < NUM_PTS; i++) {
        let sum = 0;
        for (const row of avgBuf.current) sum += row[i];
        sweep.push(sum / avgBuf.current.length);
      }

      // EMA-smooth for display
      curData.current = emaSmooth(curData.current, sweep, 0.65);
      wfRows.current  = [curData.current, ...wfRows.current.slice(0, WF_ROWS - 1)];

      redraw();
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [redraw]);

  // ── redraw on range change ────────────────────────────────────────────
  useEffect(() => { redraw(); }, [dBmMax, dBmMin, redraw]);

  // ── frequency counter ─────────────────────────────────────────────────
  const freqDigits = "0010.000000";

  // ── render ─────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        display:       "flex",
        flexDirection: "column",
        width:         "100%",
        height:        "100%",
        background:    "#1a1a1a",
        fontFamily:    "Segoe UI, system-ui, sans-serif",
        overflow:      "hidden",
      }}
    >
      {/* ══ INFO BAR ══════════════════════════════════════════════════════ */}
      <div
        style={{
          height:       26,
          display:      "flex",
          alignItems:   "center",
          padding:      "0 6px 0 8px",
          background:   "#e8e8e8",
          color:        "#1a1a1a",
          fontSize:     13,
          borderBottom: "1px solid #bbb",
          flexShrink:   0,
        }}
      >
        <span style={{ flex: 1, fontWeight: 500 }}>
          01-IZT-R3000 172.16.65.20
        </span>
        {/* maximise button */}
        <span
          style={{
            cursor:         "pointer",
            width:          20,
            height:         20,
            display:        "inline-flex",
            alignItems:     "center",
            justifyContent: "center",
            border:         "1px solid #bbb",
            borderRadius:   2,
            background:     "#f0f0f0",
            fontSize:       12,
            color:          "#444",
            marginRight:    4,
          }}
        >
          🗖
        </span>
        {/* close button */}
        <span
          onClick={onClose}
          style={{
            cursor:         "pointer",
            width:          20,
            height:         20,
            display:        "inline-flex",
            alignItems:     "center",
            justifyContent: "center",
            border:         "1px solid #bbb",
            borderRadius:   2,
            background:     "#f0f0f0",
            fontSize:       14,
            fontWeight:     700,
            color:          "#c00",
            userSelect:     "none",
          }}
          title="Close spectrum analyzer"
        >
          ✕
        </span>
      </div>

      {/* ══ FREQUENCY AXIS ════════════════════════════════════════════════ */}
      <div
        style={{
          height:         20,
          display:        "flex",
          justifyContent: "space-between",
          alignItems:     "center",
          padding:        "0 3.2% 0 3.2%",
          background:     "#e0e0e0",
          fontSize:       11,
          color:          "#333",
          flexShrink:     0,
          borderBottom:   "1px solid #bbb",
        }}
      >
        {FREQ_TICKS.map((f) => (
          <span key={f} style={{ whiteSpace: "nowrap" }}>
            {f.toFixed(3)}&nbsp;MHz
          </span>
        ))}
      </div>

      {/* ══ SPECTRUM CANVAS ═══════════════════════════════════════════════ */}
      <div style={{ flex: 2, minHeight: 0 }}>
        <canvas
          ref={specRef}
          width={CW}
          height={SH}
          style={{ width: "100%", height: "100%", display: "block" }}
        />
      </div>

      {/* ══ COLOUR RAMP SEPARATOR ═════════════════════════════════════════ */}
      <div
        style={{
          height:     4,
          background:
            "linear-gradient(to right, #000 0%, #000060 8%, #0044cc 16%, #00aaff 28%, #00ff88 42%, #aaff00 55%, #ffff00 65%, #ff8800 78%, #ff0000 90%, #ff0000 100%)",
          flexShrink: 0,
        }}
      />

      {/* ══ WATERFALL CANVAS ══════════════════════════════════════════════ */}
      <div style={{ flex: 1.8, minHeight: 0 }}>
        <canvas
          ref={wfRef}
          width={CW}
          height={WH}
          style={{ width: "100%", height: "100%", display: "block" }}
        />
      </div>

      {/* ══ CONTROLS BAR ══════════════════════════════════════════════════ */}
      <div
        style={{
          height:      34,
          display:     "flex",
          alignItems:  "center",
          gap:         10,
          padding:     "0 8px",
          background:  "#e8e8e8",
          color:       "#1a1a1a",
          fontSize:    12,
          borderTop:   "1px solid #bbb",
          flexShrink:  0,
          flexWrap:    "nowrap",
          overflow:    "hidden",
        }}
      >
        {/* Avg */}
        <Spinner
          label="Avg:"
          value={avg}
          onUp={() =>   setAvg((v) => Math.min(256, v * 2))}
          onDown={() => setAvg((v) => Math.max(1, v / 2))}
        />

        {/* Len (dropdown) */}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
          <span>Len:</span>
          <select
            value={lenIdx}
            onChange={(e) => setLenIdx(Number(e.target.value))}
            style={{
              fontSize:     11,
              padding:      "2px 4px",
              border:       "1px solid #aaa",
              borderRadius: 2,
              background:   "#fff",
              cursor:       "pointer",
              color:        "#222",
            }}
          >
            {LEN_OPTIONS.map((opt, i) => (
              <option key={i} value={i}>{opt}</option>
            ))}
          </select>
        </span>

        <span style={{ color: "#888", fontSize: 16, lineHeight: 1 }}>·</span>

        {/* Refresh */}
        <Spinner
          label="Refresh:"
          value={refresh}
          onUp={() =>   setRefresh((v) => Math.min(30, v + 1))}
          onDown={() => setRefresh((v) => Math.max(1, v - 1))}
        />

        {/* spacer pushes rest to the right */}
        <span style={{ flex: 1 }} />

        {/* Max */}
        <Spinner
          label="Max:"
          value={dBmMax}
          onUp={() =>   setDBmMax((v) => Math.min(0, v + 5))}
          onDown={() => setDBmMax((v) => Math.max(dBmMin + 10, v - 5))}
        />

        {/* Min */}
        <Spinner
          label="Min:"
          value={dBmMin}
          onUp={() =>   setDBmMin((v) => Math.min(dBmMax - 10, v + 5))}
          onDown={() => setDBmMin((v) => Math.max(-180, v - 5))}
        />

        {/* Auto Scale */}
        <label
          style={{
            display:    "flex",
            alignItems: "center",
            gap:        3,
            fontSize:   12,
            cursor:     "pointer",
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={autoScale}
            onChange={(e) => setAutoScale(e.target.checked)}
            style={{ accentColor: "#0078d4", cursor: "pointer" }}
          />
          Auto&nbsp;Scale
        </label>

        {/* secondary checkbox */}
        <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
          <input type="checkbox" style={{ accentColor: "#0078d4", cursor: "pointer" }} />
        </label>

        <span style={{ color: "#888", fontWeight: 700 }}>»</span>

        {/* ── FREQUENCY COUNTER DISPLAY ──────────────────────────────── */}
        <div
          style={{
            display:      "flex",
            gap:          2,
            background:   "#000",
            padding:      "3px 10px",
            borderRadius: 3,
            border:       "1px solid #555",
            marginLeft:   4,
          }}
        >
          {freqDigits.split("").map((c, i) => (
            <span
              key={i}
              style={{
                color:      c === "." ? "#eee" : "#00ff00",
                fontFamily: "'Consolas', 'Courier New', monospace",
                fontWeight: 700,
                fontSize:   17,
                minWidth:   c === "." ? 6 : 13,
                textAlign:  "center",
                textShadow: c !== "." ? "0 0 6px rgba(0,255,0,0.5)" : "none",
              }}
            >
              {c}
            </span>
          ))}
        </div>

        {/* ── STOP / PLAY BUTTON (red square) ────────────────────────── */}
        <button
          onClick={() => setRunning((r) => !r)}
          title={running ? "Pause" : "Resume"}
          style={{
            width:          24,
            height:         24,
            border:         "1px solid #888",
            borderRadius:   3,
            background:     running ? "#fff" : "#fdd",
            cursor:         "pointer",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            padding:        0,
            marginLeft:     4,
            flexShrink:     0,
          }}
        >
          {running ? (
            <span style={{ display: "block", width: 12, height: 12, background: "#c00", borderRadius: 1 }} />
          ) : (
            <span
              style={{
                display:      "block",
                width:        0,
                height:       0,
                borderLeft:   "10px solid #0a0",
                borderTop:    "6px solid transparent",
                borderBottom: "6px solid transparent",
                marginLeft:   2,
              }}
            />
          )}
        </button>
      </div>
    </div>
  );
}
