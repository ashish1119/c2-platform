import React from "react";
import type { DFDevice } from "../hooks/useDFData";

const C = {
  bg:      "#060d1a",
  card:    "#0b1a2e",
  border:  "#0e2a45",
  active:  "#4ade80",
  cyan:    "#7dd3fc",
  offline: "#f87171",
  scan:    "#fbbf24",
  text:    "#e2f0ff",
  muted:   "#8ba3c0",
};

function StatusDot({ status }: { status: DFDevice["status"] }) {
  const color = status === "active" ? C.active : status === "scanning" ? C.scan : C.offline;
  const label = status === "active" ? "ACTIVE" : status === "scanning" ? "SCAN" : "OFFLINE";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{
        width: 7, height: 7, borderRadius: "50%", background: color,
        boxShadow: status !== "offline" ? `0 0 6px ${color}` : "none",
        animation: status === "active" ? "dfPulse 2s ease-in-out infinite" : "none",
      }} />
      <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: "0.5px" }}>{label}</span>
    </div>
  );
}

type Props = {
  devices: DFDevice[];
  activeId: string;
  onSelect: (id: string) => void;
};

export default function DFDevicePanel({ devices, activeId, onSelect }: Props) {
  return (
    <div style={{
      background: C.bg,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      display: "flex",
      flexDirection: "column",
      height: "100%",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "10px 14px",
        borderBottom: `1px solid ${C.border}`,
        background: "rgba(0,229,255,0.04)",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.cyan, boxShadow: `0 0 6px ${C.cyan}` }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: C.cyan, letterSpacing: "1.5px", fontFamily: "monospace" }}>
          DIRECTION FINDER DEVICES
        </span>
        <span style={{
          marginLeft: "auto", fontSize: 9, fontWeight: 700,
          color: C.active, background: "rgba(0,255,136,0.1)",
          border: "1px solid rgba(0,255,136,0.3)",
          padding: "1px 7px", borderRadius: 10,
        }}>
          {devices.filter((d) => d.status !== "offline").length}/{devices.length} ONLINE
        </span>
      </div>

      {/* Device list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
        {devices.map((d) => {
          const isActive = d.id === activeId;
          return (
            <div
              key={d.id}
              onClick={() => onSelect(d.id)}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                marginBottom: 6,
                cursor: "pointer",
                border: isActive
                  ? `1px solid rgba(0,229,255,0.5)`
                  : `1px solid ${C.border}`,
                background: isActive
                  ? "rgba(0,229,255,0.08)"
                  : C.card,
                transition: "all 0.18s ease",
                boxShadow: isActive ? "0 0 12px rgba(0,229,255,0.1)" : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: isActive ? C.cyan : C.text, fontFamily: "monospace" }}>
                  {d.name}
                </span>
                <StatusDot status={d.status} />
              </div>

              <div style={{ fontSize: 10, color: C.muted, display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>📍 {d.location}</span>
                  <span style={{ color: d.status !== "offline" ? C.text : C.muted }}>
                    {d.status !== "offline" ? `${d.frequency.toFixed(1)} MHz` : "—"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Range: {d.scanRange} km</span>
                  {d.status !== "offline" && (
                    <span style={{ color: d.signalDbm > -75 ? C.active : d.signalDbm > -85 ? C.scan : C.offline }}>
                      {d.signalDbm.toFixed(0)} dBm
                    </span>
                  )}
                </div>
                {d.status !== "offline" && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <span>BRG: {d.bearing.toFixed(0)}°</span>
                    </div>
                    {/* Signal bar */}
                    <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.08)" }}>
                      <div style={{
                        height: "100%", borderRadius: 2,
                        width: `${Math.max(5, Math.min(100, (d.signalDbm + 110) / 50 * 100))}%`,
                        background: d.signalDbm > -75 ? C.active : d.signalDbm > -85 ? C.scan : C.offline,
                        boxShadow: `0 0 4px ${d.signalDbm > -75 ? C.active : C.scan}`,
                        transition: "width 0.4s ease",
                      }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes dfPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
