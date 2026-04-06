import React from "react";
import { useDFData, type DFDevice, type FrequencyHit } from "./hooks/useDFData";
import DFDevicePanel from "./components/DFDevicePanel";
import MapView from "./components/MapView";
import SpectrumChart from "./components/SpectrumChart";
import WaterfallChart from "./components/WaterfallChart";
import FrequencyTable from "./components/FrequencyTable";

const BG = "#04080f";
const CARD = "#060d1a";
const BORDER = "#0e2a45";
const CYAN = "#00e5ff";
const GREEN = "#00ff88";
const MUTED = "#3d6080";

export default function DFIntelligencePage() {
  const { devices, spectrum, waterfall, hits, activeDevice, activeDeviceId, setActiveDeviceId } = useDFData();

  return (
    <div style={{
      background: BG,
      display: "flex",
      flexDirection: "column",
      height: "100%",
      minHeight: 0,
      gap: 12,
      padding: 14,
      fontFamily: "'Inter', system-ui, sans-serif",
      boxSizing: "border-box",
      overflowY: "auto",
      overflowX: "hidden",
    }}>

      {/* ── Status bar ── */}
      <div style={{
        flexShrink: 0,
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        padding: "9px 16px",
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
        boxShadow: "0 0 24px rgba(0,229,255,0.05)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: CYAN, boxShadow: `0 0 8px ${CYAN}`, animation: "dfPulse 2s ease-in-out infinite" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: CYAN, letterSpacing: "1px" }}>DF INTELLIGENCE</span>
          <span style={{ fontSize: 11, color: "#8ba3c0", letterSpacing: "0.3px", fontWeight: 500 }}>DIRECTION FINDER COMMAND CENTER</span>
        </div>
        <div style={{ display: "flex", gap: 20, marginLeft: "auto", flexWrap: "wrap" }}>
          {([
            { label: "STATIONS",   value: `${devices.filter((d: DFDevice) => d.status !== "offline").length}/${devices.length}`, color: CYAN },
            { label: "ACTIVE",     value: String(devices.filter((d: DFDevice) => d.status === "active").length),   color: GREEN },
            { label: "SCANNING",   value: String(devices.filter((d: DFDevice) => d.status === "scanning").length), color: "#f59e0b" },
            { label: "INTERCEPTS", value: String(hits.filter((h: FrequencyHit) => h.active).length),               color: "#ef4444" },
          ] as { label: string; value: string; color: string }[]).map(({ label, value, color }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 10, color: "#8ba3c0", marginTop: 3, letterSpacing: "0.4px", fontWeight: 500 }}>{label}</div>
            </div>
          ))}
        </div>
        {activeDevice && (
          <div style={{ padding: "5px 14px", borderRadius: 20, background: "rgba(0,229,255,0.08)", border: `1px solid rgba(0,229,255,0.3)`, fontSize: 11, color: "#e0f7ff", fontWeight: 600, letterSpacing: "0.3px" }}>
            FOCUS: {activeDevice.name} · {activeDevice.frequency.toFixed(1)} MHz · {activeDevice.bearing.toFixed(0)}°
          </div>
        )}
      </div>

      {/* ── Main 3-column grid — min-height ensures map is always tall ── */}
      <div style={{
        flex: 1,
        minHeight: 480,
        display: "grid",
        gridTemplateColumns: "220px 1fr 300px",
        gap: 12,
      }}>
        {/* Left */}
        <DFDevicePanel devices={devices} activeId={activeDeviceId} onSelect={setActiveDeviceId} />

        {/* Center */}
        <MapView devices={devices} activeId={activeDeviceId} />

        {/* Right — spectrum 220px fixed + waterfall fills rest, min 300px */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
          <div style={{ flexShrink: 0, height: 220 }}>
            <SpectrumChart spectrum={spectrum} />
          </div>
          <div style={{ flex: 1, minHeight: 300 }}>
            <WaterfallChart waterfall={waterfall} />
          </div>
        </div>
      </div>

      {/* ── Bottom table — compact, max 240px scrollable ── */}
      <div style={{ flexShrink: 0, maxHeight: 240, display: "flex", flexDirection: "column" }}>
        <FrequencyTable hits={hits} />
      </div>

      <style>{`
        @keyframes dfPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px ${CYAN}; }
          50%       { opacity: 0.35; box-shadow: 0 0 3px ${CYAN}; }
        }
        @keyframes dfDash { to { stroke-dashoffset: -20; } }
        .df-bearing-line { animation: dfDash 1.2s linear infinite; }
      `}</style>
    </div>
  );
}
