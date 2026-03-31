import React from "react";

interface ClassifierTableProps {
  data: any[];
  onSelectRow?: (row: any) => void;
  selectedRowIndex?: number;
}

const columns = [
  "StreamId", "Label", "Frequency", "SR", "Filter BW", "Note", "Protocol", "Power", "Disabled", "Channels", "Lock", "DeviceId", "Drift", "DfInfo"
];

const ClassifierTable: React.FC<ClassifierTableProps> = ({ data, onSelectRow, selectedRowIndex }) => (
  <div style={{ background: "#181c24", color: "#eee", border: "1px solid #222", borderRadius: 6, overflow: "auto", maxHeight: 260 }}>
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
          <tr key={i} style={{ background: selectedRowIndex === i ? "#263238" : i % 2 ? "#1e222b" : "#181c24", cursor: "pointer" }}
              onClick={() => onSelectRow && onSelectRow(row)}>
            {columns.map((col) => (
              <td key={col} style={{ padding: 5, borderBottom: "1px solid #222", whiteSpace: "nowrap" }}>{row[col] ?? row[col.toLowerCase()] ?? "-"}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default ClassifierTable;
