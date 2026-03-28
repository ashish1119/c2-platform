import React, { useEffect, useState } from "react";
import Card from "../../components/ui/Card";

type RFDataType = {
  id: number;
  freq: number;
  power: number;
  snr: number;
  lat?: number;
  lon?: number;
  DOA: number;
};

const thStyle = {
  padding: 8,
  border: "1px solid #32475a",
  background: "#192a3f",
  position: "sticky" as const,
  top: 0,
  zIndex: 2,
};

const tdStyle = {
  padding: 8,
  border: "1px solid #32475a",
};

function InterceptListTable({
  data,
  highlightIds,
}: {
  data: RFDataType[];
  highlightIds: number[];
}) {
  return (
    <div
      style={{
        maxHeight: "400px",
        overflowY: "auto",
        overflowX: "auto",
        border: "1px solid #32475a",
      }}
    >
      <table
        style={{
          width: "100%",
          minWidth: "1200px",
          borderCollapse: "collapse",
          color: "#ffffff",
        }}
      >
        <thead>
          <tr>
            <th style={thStyle}>Id</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>First Seen</th>
            <th style={thStyle}>Carrier</th>
            <th style={thStyle}>BW</th>
            <th style={thStyle}>Duration</th>
            <th style={thStyle}>Power</th>
            <th style={thStyle}>SNR</th>
            <th style={thStyle}>DOA</th>
            <th style={thStyle}>DOA Avg</th>
            <th style={thStyle}>DOA Std.</th>
            <th style={thStyle}>Peak</th>
          </tr>
        </thead>

        <tbody>
          {data.length > 0 ? (
            data.map((row, idx) => {
              const isNew = highlightIds.includes(row.id);

              return (
                <tr
                  key={row.id}
                  style={{
                    background: isNew
                      ? "#00ffcc33"
                      : idx % 2 === 0
                      ? "#122033"
                      : "#0f1a2a",
                    boxShadow: isNew ? "0 0 10px #00ffcc" : "none",
                    transition: "all 0.5s ease",
                  }}
                >
                  <td style={tdStyle}>{row.id}</td>
                  <td style={{ ...tdStyle, color: "lime" }}>ACTIVE</td>
                  <td style={tdStyle}>
                    {new Date().toLocaleTimeString()}
                  </td>
                  <td style={tdStyle}>{row.freq}</td>
                  <td style={tdStyle}>-</td>
                  <td style={tdStyle}>-</td>
                  <td style={tdStyle}>{row.power}</td>
                  <td style={tdStyle}>{row.snr}</td>
                  <td style={tdStyle}>{row.DOA !== undefined ? row.DOA.toFixed(2) : "-"}</td>
                  <td style={tdStyle}>-</td>
                  <td style={tdStyle}>-</td>
                  <td style={tdStyle}>-</td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={12} style={{ padding: 10, textAlign: "center" }}>
                Dummy Intercept Data
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function CESMTableTabs() {
  const [activeSubTab, setActiveSubTab] = useState(0);
  const [rfData, setRfData] = useState<RFDataType[]>([]);
  const [highlightIds, setHighlightIds] = useState<number[]>([]);

  const subTabs = [
    "INTERCEPT LIST",
    "TARGET LIST",
    "UNIDENTIFIED LIST",
    "COMPASS DF",
  ];

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      console.warn("RF websocket token is missing");
      return;
    }

    const ws = new WebSocket(`ws://localhost:8000/ws/rf-data?token=${encodeURIComponent(token)}`);

    ws.onopen = () => console.log("WS Connected");

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (typeof message?.id !== "number" || typeof message?.freq !== "number") {
        return;
      }

      setRfData((prev) => [message, ...prev].slice(0, 50));
      setHighlightIds((prev) => [...prev, message.id]);

      setTimeout(() => {
        setHighlightIds((prev) => prev.filter((id) => id !== message.id));
      }, 2000);
    };

    ws.onerror = (err) => console.log("WS Error:", err);
    ws.onclose = () => console.log("WS Closed");

    return () => ws.close();
  }, []);

  return (
    <Card>
      <div style={{ marginTop: 16 }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          {subTabs.map((tab, idx) => (
            <button
              key={tab}
              onClick={() => setActiveSubTab(idx)}
              style={{
                padding: "6px 12px",
                borderRadius: 4,
                border: "none",
                background: activeSubTab === idx ? "#1976d2" : "#e0e0e0",
                color: activeSubTab === idx ? "#fff" : "#333",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeSubTab === 0 && (
          <InterceptListTable
            data={rfData}
            highlightIds={highlightIds}
          />
        )}

        {activeSubTab === 1 && <div>Target List (unchanged)</div>}
        {activeSubTab === 2 && <div>Unidentified List (unchanged)</div>}
        {activeSubTab === 3 && <div>Compass DF (unchanged)</div>}
      </div>
    </Card>
  );
}