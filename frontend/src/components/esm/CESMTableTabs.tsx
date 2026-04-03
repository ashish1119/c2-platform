import React, { useEffect, useState } from "react";

// ── Types (unchanged from original) ──────────────────────────────────────────
type RFDataType = {
  id: number;
  freq: number;
  power: number;
  snr: number;
  lat?: number;
  lon?: number;
  DOA: number;
  status?: string;
  timestamp?: string;
};

// ── Status colour map ─────────────────────────────────────────────────────────
function statusColor(status?: string): string {
  switch (status) {
    case "NEW":    return "#22c55e";
    case "UPDATE": return "#f59e0b";
    case "HOLD":   return "#facc15";
    default:       return "#ef4444";
  }
}

// ── Table header / cell styles ────────────────────────────────────────────────
const TH_STYLE: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid rgba(0,229,255,0.15)",
  borderRight: "1px solid rgba(0,229,255,0.08)",
  background: "rgba(0,229,255,0.06)",
  color: "#00E5FF",
  fontSize: 10,
  fontWeight: 700,
  fontFamily: "monospace",
  letterSpacing: "0.8px",
  textAlign: "left" as const,
  whiteSpace: "nowrap" as const,
  position: "sticky" as const,
  top: 0,
  zIndex: 2,
};

const TD_STYLE: React.CSSProperties = {
  padding: "7px 10px",
  borderBottom: "1px solid rgba(0,229,255,0.06)",
  borderRight: "1px solid rgba(0,229,255,0.04)",
  fontSize: 11,
  fontFamily: "monospace",
  color: "#94a3b8",
  whiteSpace: "nowrap" as const,
};

// ── Intercept table ───────────────────────────────────────────────────────────
function InterceptListTable({ data, highlightIds }: { data: RFDataType[]; highlightIds: number[] }) {
  const cols = ["ID", "STATUS", "FIRST SEEN", "CARRIER", "BW", "DURATION", "POWER", "SNR", "DOA", "DOA AVG", "DOA STD", "PEAK"];

  return (
    <div style={{ maxHeight: 340, overflowY: "auto", overflowX: "auto" }}>
      <table style={{ width: "100%", minWidth: 1100, borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {cols.map(c => <th key={c} style={TH_STYLE}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.length > 0 ? data.map((row, idx) => {
            const isNew = highlightIds.includes(row.id);
            return (
              <tr key={row.id} style={{
                background: isNew
                  ? "rgba(0,229,255,0.08)"
                  : idx % 2 === 0 ? "rgba(2,6,23,0.6)" : "rgba(11,18,32,0.6)",
                boxShadow: isNew ? "inset 0 0 12px rgba(0,229,255,0.12)" : "none",
                transition: "all 0.4s ease",
              }}>
                <td style={{ ...TD_STYLE, color: "#e2e8f0" }}>{row.id}</td>
                <td style={{ ...TD_STYLE }}>
                  <span style={{
                    color: statusColor(row.status),
                    fontWeight: 700,
                    fontSize: 10,
                    padding: "2px 6px",
                    borderRadius: 3,
                    background: `${statusColor(row.status)}18`,
                    border: `1px solid ${statusColor(row.status)}40`,
                  }}>
                    {row.status ?? "—"}
                  </span>
                </td>
                <td style={TD_STYLE}>{row.timestamp ? new Date(row.timestamp).toLocaleTimeString() : "—"}</td>
                <td style={{ ...TD_STYLE, color: "#00E5FF" }}>{row.freq} MHz</td>
                <td style={TD_STYLE}>—</td>
                <td style={TD_STYLE}>—</td>
                <td style={{ ...TD_STYLE, color: row.power > -80 ? "#f59e0b" : "#94a3b8" }}>{row.power} dBm</td>
                <td style={{ ...TD_STYLE, color: row.snr > 15 ? "#22c55e" : "#94a3b8" }}>{row.snr} dB</td>
                <td style={{ ...TD_STYLE, color: "#e2e8f0" }}>{row.DOA !== undefined ? row.DOA.toFixed(1) + "°" : "—"}</td>
                <td style={TD_STYLE}>—</td>
                <td style={TD_STYLE}>—</td>
                <td style={TD_STYLE}>—</td>
              </tr>
            );
          }) : (
            <tr>
              <td colSpan={12} style={{ padding: 24, textAlign: "center", color: "#334155", fontFamily: "monospace", fontSize: 12 }}>
                NO DETECTION DATA — AWAITING SIGNAL
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Empty placeholder ─────────────────────────────────────────────────────────
function EmptyPanel({ label }: { label: string }) {
  return (
    <div style={{ padding: 32, textAlign: "center", color: "#334155", fontFamily: "monospace", fontSize: 12 }}>
      {label} — NO DATA
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CESMTableTabs() {
  const [activeSubTab, setActiveSubTab] = useState(0);
  const [rfData, setRfData] = useState<RFDataType[]>([]);
  const [highlightIds, setHighlightIds] = useState<number[]>([]);
  const [wsStatus, setWsStatus] = useState<"connecting" | "live" | "offline">("connecting");

  const subTabs = ["INTERCEPT LIST", "TARGET LIST", "UNIDENTIFIED LIST", "COMPASS DF"];

  // ── WebSocket logic unchanged from original ───────────────────────────────
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8000/ws/rf");

    ws.onopen = () => { setWsStatus("live"); };

    ws.onmessage = (event) => {
      try {
        const lines = event.data.split("\n").filter(Boolean);
        const parsedData = lines.map((line: string) => JSON.parse(line));

        const converted: RFDataType[] = parsedData.map((det: any): RFDataType => ({
          id: det.id,
          freq: det.freq || 0,
          power: det.power || 0,
          snr: det.snr || 0,
          lat: det.lat,
          lon: det.lon,
          DOA: det.doa || 0,
          status: det.status,
          timestamp: det.timestamp,
        }));

        setRfData((prev) => {
          let updated = [...prev];
          converted.forEach((item: RFDataType) => {
            const index = updated.findIndex((d) => d.id === item.id);
            if (item.status === "OBSOLETE") {
              updated = updated.filter((d) => d.id !== item.id);
            } else if (index !== -1) {
              updated[index] = item;
            } else {
              updated.unshift(item);
            }
          });
          updated = updated.slice(0, 50);
          const newIds = converted.filter((d: RFDataType) => d.status === "NEW").map((d: RFDataType) => d.id);
          setHighlightIds(newIds);
          setTimeout(() => setHighlightIds([]), 2000);
          return updated;
        });
      } catch (err) {
        console.error("❌ WebSocket parse error:", err);
      }
    };

    ws.onerror = () => { setWsStatus("offline"); };
    ws.onclose = () => { setWsStatus("offline"); };

    return () => { ws.close(); };
  }, []);

  const wsColor = wsStatus === "live" ? "#22c55e" : wsStatus === "connecting" ? "#f59e0b" : "#ef4444";
  const wsLabel = wsStatus === "live" ? "LIVE" : wsStatus === "connecting" ? "CONNECTING" : "OFFLINE";

  return (
    <div style={{
      background: "linear-gradient(180deg, #020617 0%, #0B1220 100%)",
      border: "1px solid rgba(0,229,255,0.18)",
      borderRadius: 10,
      overflow: "hidden",
      boxShadow: "0 0 24px rgba(0,229,255,0.06)",
    }}>
      {/* Tab bar */}
      <div style={{
        display: "flex", alignItems: "center",
        padding: "0 12px",
        borderBottom: "1px solid rgba(0,229,255,0.12)",
        background: "rgba(0,229,255,0.03)",
        gap: 2,
      }}>
        {subTabs.map((tab, idx) => {
          const isActive = activeSubTab === idx;
          return (
            <button
              key={tab}
              onClick={() => setActiveSubTab(idx)}
              style={{
                padding: "9px 14px",
                fontSize: 10,
                fontWeight: 700,
                fontFamily: "monospace",
                letterSpacing: "0.8px",
                cursor: "pointer",
                border: "none",
                borderBottom: isActive ? "2px solid #00E5FF" : "2px solid transparent",
                background: "transparent",
                color: isActive ? "#00E5FF" : "#334155",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
              }}
            >
              {tab}
            </button>
          );
        })}

        {/* WS status pill */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "4px 10px" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: wsColor, boxShadow: `0 0 5px ${wsColor}` }} />
          <span style={{ fontSize: 9, fontWeight: 700, fontFamily: "monospace", color: wsColor, letterSpacing: "0.5px" }}>
            {wsLabel}
          </span>
          <span style={{ fontSize: 9, fontFamily: "monospace", color: "#334155" }}>
            {rfData.length} TRACKS
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "8px 0" }}>
        {activeSubTab === 0 && <InterceptListTable data={rfData} highlightIds={highlightIds} />}
        {activeSubTab === 1 && <EmptyPanel label="TARGET LIST" />}
        {activeSubTab === 2 && <EmptyPanel label="UNIDENTIFIED LIST" />}
        {activeSubTab === 3 && <EmptyPanel label="COMPASS DF" />}
      </div>
    </div>
  );
}
