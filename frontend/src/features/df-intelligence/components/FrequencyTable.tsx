import React from "react";
import type { FrequencyHit } from "../hooks/useDFData";

const C = { bg: "#060d1a", card: "#0b1a2e", border: "#0e2a45", cyan: "#00e5ff", green: "#00ff88", warn: "#f59e0b", danger: "#ef4444", text: "#c8dff0", muted: "#3d6080" };

const TH: React.CSSProperties = {
  padding: "7px 12px", textAlign: "left", fontSize: 10, fontWeight: 700,
  fontFamily: "'Inter', 'system-ui', monospace", letterSpacing: "0.6px", color: "#e0f7ff",
  borderBottom: `1px solid ${C.border}`, background: "#060d1a",
  whiteSpace: "nowrap",
  position: "sticky", top: 0, zIndex: 2,
};
const TD: React.CSSProperties = {
  padding: "6px 12px", fontSize: 12, fontFamily: "'Inter', 'system-ui', monospace",
  color: "#d0e8f8", borderBottom: `1px solid rgba(14,42,69,0.5)`, whiteSpace: "nowrap",
  fontWeight: 500,
};

function ConfBar({ pct }: { pct: number }) {
  const color = pct >= 85 ? C.green : pct >= 65 ? C.warn : C.danger;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 60, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)" }}>
        <div style={{ height: "100%", borderRadius: 2, width: `${pct}%`, background: color, boxShadow: `0 0 4px ${color}`, transition: "width 0.3s" }} />
      </div>
      <span style={{ color, fontWeight: 700, fontSize: 10 }}>{pct}%</span>
    </div>
  );
}

type Props = { hits: FrequencyHit[] };

export default function FrequencyTable({ hits }: Props) {
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "9px 16px", borderBottom: `1px solid ${C.border}`, background: "rgba(0,229,255,0.04)", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.cyan, boxShadow: `0 0 6px ${C.cyan}` }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: "#e0f7ff", letterSpacing: "1px", fontFamily: "'Inter','system-ui',monospace" }}>FREQUENCY INTERCEPT LOG</span>
        <span style={{ marginLeft: "auto", fontSize: 11, fontFamily: "'Inter','system-ui',monospace", color: "#8ba3c0", fontWeight: 500 }}>{hits.filter(h => h.active).length} ACTIVE · {hits.length} TOTAL</span>
      </div>
      <div style={{ overflowX: "auto", maxHeight: 190, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
          <thead>
            <tr>
              {["FREQUENCY", "MODE", "DETECTED", "SIGNAL", "BEARING", "CONFIDENCE", "SOURCE", "STATUS"].map(h => (
                <th key={h} style={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hits.map((h, i) => (
              <tr key={h.id} style={{
                background: h.active
                  ? "rgba(0,255,136,0.05)"
                  : i % 2 === 0 ? "rgba(11,26,46,0.5)" : "transparent",
                borderLeft: h.active ? `2px solid ${C.green}` : "2px solid transparent",
                transition: "background 0.2s",
              }}>
                <td style={{ ...TD, color: "#7dd3fc", fontWeight: 700 }}>{h.freq.toFixed(3)} MHz</td>
                <td style={TD}>
                  <span style={{ padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: "rgba(0,229,255,0.1)", color: "#e0f7ff", border: `1px solid rgba(0,229,255,0.25)` }}>{h.mode}</span>
                </td>
                <td style={{ ...TD, color: "#8ba3c0" }}>{h.detectedAt}</td>
                <td style={{ ...TD, color: h.signalDbm > -75 ? "#4ade80" : h.signalDbm > -85 ? "#fbbf24" : "#f87171", fontWeight: 700 }}>{h.signalDbm} dBm</td>
                <td style={{ ...TD, color: "#d0e8f8", fontWeight: 600 }}>{h.bearing.toFixed(0)}°</td>
                <td style={TD}><ConfBar pct={h.confidence} /></td>
                <td style={{ ...TD, color: "#8ba3c0" }}>{h.source}</td>
                <td style={TD}>
                  {h.active
                    ? <span style={{ color: "#4ade80", fontWeight: 700, fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />LIVE</span>
                    : <span style={{ color: "#8ba3c0", fontSize: 11, fontWeight: 500 }}>LOGGED</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
