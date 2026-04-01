import React from "react";

interface HistoryTableProps {
  data: any[];
}

const columns = ["Label", "Frequency", "Protocol", "Power", "Timestamp", "DeviceId"];

const HistoryTable: React.FC<HistoryTableProps> = ({ data }) => (
  <div style={{ background: "#181c24", color: "#eee", border: "1px solid #222", borderRadius: 6, overflow: "auto", maxHeight: 180 }}>
    <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "monospace", fontSize: 13 }}>
      <thead style={{ position: "sticky", top: 0, background: "#232733", zIndex: 1 }}>
        <tr>
          {columns.map((col) => (
            <th key={col} style={{ padding: 6, borderBottom: "1px solid #333", color: "#90caf9", textAlign: "left", fontWeight: 600 }}>{col}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i} style={{ background: i % 2 ? "#1e222b" : "#181c24" }}>
            <td style={{ padding: 5, borderBottom: "1px solid #222" }}>{row.Label ?? row.label ?? "-"}</td>
            <td style={{ padding: 5, borderBottom: "1px solid #222" }}>{row.Frequency ?? row.frequency ?? "-"}</td>
            <td style={{ padding: 5, borderBottom: "1px solid #222" }}>{row.Protocol ?? row.protocol ?? "-"}</td>
            <td style={{ padding: 5, borderBottom: "1px solid #222" }}>{row.Power ?? row.power ?? "-"}</td>
            <td style={{ padding: 5, borderBottom: "1px solid #222" }}>{row.Timestamp ?? row.timestamp ?? row.Time ?? row.time ?? "-"}</td>
            <td style={{ padding: 5, borderBottom: "1px solid #222" }}>{row.DeviceId ?? row.device_id ?? "-"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default HistoryTable;
