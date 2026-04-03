import React, { useState, useMemo, useRef, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

// ── Custom neon tooltip ───────────────────────────────────────────────────────
function SpectrumTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const level = payload[0]?.value as number;
  const color = level > -90 ? "#00E5FF" : level > -110 ? "#2563EB" : "#334155";
  return (
    <div style={{
      background: "rgba(2,6,23,0.95)",
      border: `1px solid ${color}`,
      borderRadius: 6,
      padding: "8px 12px",
      fontSize: 11,
      fontFamily: "monospace",
      boxShadow: `0 0 12px ${color}40`,
    }}>
      <div style={{ color: "#64748b", marginBottom: 3 }}>FREQ: <span style={{ color: "#e2e8f0" }}>{label} MHz</span></div>
      <div style={{ color: "#64748b" }}>LEVEL: <span style={{ color, fontWeight: 700 }}>{level?.toFixed(1)} dBm</span></div>
    </div>
  );
}

// ── Crosshair cursor line ─────────────────────────────────────────────────────
function CrosshairCursor({ points, width, height }: any) {
  if (!points?.length) return null;
  const x = points[0]?.x;
  return (
    <line
      x1={x} y1={0} x2={x} y2={height}
      stroke="rgba(0,229,255,0.35)"
      strokeWidth={1}
      strokeDasharray="4 3"
    />
  );
}

export default function CESMSpectrum() {
  const [hoveredFreq, setHoveredFreq] = useState<number | null>(null);

  const spectrumData = useMemo(() => Array.from({ length: 100 }, (_, i) => ({
    freq: 400 + i * 1,
    level: Math.random() * 20 - 120 + (i === 50 ? 30 : 0),
  })), []);

  const peakLevel = useMemo(() => Math.max(...spectrumData.map(d => d.level)), [spectrumData]);
  const avgLevel  = useMemo(() => spectrumData.reduce((s, d) => s + d.level, 0) / spectrumData.length, [spectrumData]);

  return (
    <div style={{
      background: "linear-gradient(180deg, #020617 0%, #0B1220 100%)",
      border: "1px solid rgba(0,229,255,0.18)",
      borderRadius: 10,
      overflow: "hidden",
      boxShadow: "0 0 24px rgba(0,229,255,0.06), inset 0 1px 0 rgba(0,229,255,0.08)",
    }}>
      {/* Header bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 16px",
        borderBottom: "1px solid rgba(0,229,255,0.1)",
        background: "rgba(0,229,255,0.04)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00E5FF", boxShadow: "0 0 6px #00E5FF" }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "#00E5FF", letterSpacing: "1.5px", fontFamily: "monospace" }}>
            FFT SPECTRUM ANALYZER
          </span>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 10, fontFamily: "monospace" }}>
          <span style={{ color: "#64748b" }}>PEAK: <span style={{ color: "#00E5FF" }}>{peakLevel.toFixed(1)} dBm</span></span>
          <span style={{ color: "#64748b" }}>AVG: <span style={{ color: "#2563EB" }}>{avgLevel.toFixed(1)} dBm</span></span>
          <span style={{ color: "#64748b" }}>RBW: <span style={{ color: "#94a3b8" }}>1 MHz</span></span>
        </div>
      </div>

      {/* Chart */}
      <div style={{ height: 220, padding: "8px 4px 4px 0" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={spectrumData} margin={{ top: 10, right: 20, left: 4, bottom: 4 }}>
            <defs>
              <linearGradient id="spectrumGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00E5FF" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#00E5FF" stopOpacity={0} />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <CartesianGrid
              strokeDasharray="4 4"
              stroke="rgba(37,99,235,0.12)"
              horizontal vertical
            />

            <XAxis
              dataKey="freq"
              tick={{ fill: "#475569", fontSize: 10, fontFamily: "monospace" }}
              tickLine={{ stroke: "rgba(71,85,105,0.4)" }}
              axisLine={{ stroke: "rgba(71,85,105,0.4)" }}
              label={{ value: "FREQ [MHz]", position: "insideBottomRight", offset: -8, fill: "#475569", fontSize: 10, fontFamily: "monospace" }}
            />
            <YAxis
              domain={[-140, 0]}
              tick={{ fill: "#475569", fontSize: 10, fontFamily: "monospace" }}
              tickLine={{ stroke: "rgba(71,85,105,0.4)" }}
              axisLine={{ stroke: "rgba(71,85,105,0.4)" }}
              label={{ value: "LEVEL [dBm]", angle: -90, position: "insideLeft", fill: "#475569", fontSize: 10, fontFamily: "monospace" }}
            />

            <Tooltip content={<SpectrumTooltip />} cursor={<CrosshairCursor />} />

            {/* Noise floor reference */}
            <ReferenceLine y={-110} stroke="rgba(37,99,235,0.3)" strokeDasharray="6 3"
              label={{ value: "NOISE FLOOR", position: "insideTopRight", fill: "#2563EB", fontSize: 9, fontFamily: "monospace" }} />

            <Line
              type="monotone"
              dataKey="level"
              stroke="#00E5FF"
              dot={false}
              strokeWidth={1.5}
              filter="url(#glow)"
              activeDot={{ r: 4, fill: "#00E5FF", stroke: "rgba(0,229,255,0.4)", strokeWidth: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
