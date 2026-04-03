import { useReducer, useMemo } from "react";
import { useTheme } from "../../../context/ThemeContext";
import type { SmsDetectionRecord } from "../../../api/operatorDashboard";

type SortKey = "timestamp_utc" | "frequency_hz" | "power_dbm" | "doa_azimuth_deg";
type SortDir = "asc" | "desc";

interface SortState {
  key: SortKey;
  dir: SortDir;
}

type SortAction = { key: SortKey };

function sortReducer(state: SortState, action: SortAction): SortState {
  if (state.key === action.key) {
    return { key: action.key, dir: state.dir === "asc" ? "desc" : "asc" };
  }
  return { key: action.key, dir: "desc" };
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span style={{ opacity: 0.3 }}> ↕</span>;
  return <span>{dir === "asc" ? " ↑" : " ↓"}</span>;
}

interface DetectionTableProps {
  detections: SmsDetectionRecord[];
  maxRows?: number;
}

export default function DetectionTable({ detections, maxRows = 20 }: DetectionTableProps) {
  const { theme } = useTheme();
  const [sort, dispatchSort] = useReducer(sortReducer, { key: "timestamp_utc", dir: "desc" });

  const sorted = useMemo(() => {
    const copy = [...detections].slice(0, 200);
    copy.sort((a, b) => {
      let av: number;
      let bv: number;

      if (sort.key === "timestamp_utc") {
        av = Date.parse(a.timestamp_utc);
        bv = Date.parse(b.timestamp_utc);
      } else {
        av = (a[sort.key] as number | null | undefined) ?? -Infinity;
        bv = (b[sort.key] as number | null | undefined) ?? -Infinity;
      }

      return sort.dir === "asc" ? av - bv : bv - av;
    });
    return copy.slice(0, maxRows);
  }, [detections, sort, maxRows]);

  const thStyle: React.CSSProperties = {
    textAlign: "left",
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: theme.colors.textMuted,
    cursor: "pointer",
    userSelect: "none",
    background: theme.colors.surface,
    position: "sticky",
    top: 0,
  };

  const tdStyle: React.CSSProperties = {
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    fontSize: "13px",
    color: theme.colors.textPrimary,
    whiteSpace: "nowrap",
  };

  const columns: { label: string; key: SortKey | null; render: (d: SmsDetectionRecord) => React.ReactNode }[] = [
    {
      label: "Time",
      key: "timestamp_utc",
      render: (d) => new Date(d.timestamp_utc).toLocaleTimeString(),
    },
    {
      label: "Source",
      key: null,
      render: (d) => d.source_node,
    },
    {
      label: "Frequency",
      key: "frequency_hz",
      render: (d) => `${(d.frequency_hz / 1_000_000).toFixed(3)} MHz`,
    },
    {
      label: "Power",
      key: "power_dbm",
      render: (d) =>
        typeof d.power_dbm === "number" ? (
          <span
            style={{
              color:
                d.power_dbm >= -55
                  ? theme.colors.danger
                  : d.power_dbm >= -65
                  ? theme.colors.warning
                  : theme.colors.textPrimary,
              fontWeight: d.power_dbm >= -65 ? 600 : 400,
            }}
          >
            {d.power_dbm.toFixed(1)} dBm
          </span>
        ) : (
          "—"
        ),
    },
    {
      label: "DOA",
      key: "doa_azimuth_deg",
      render: (d) =>
        typeof d.doa_azimuth_deg === "number" ? `${d.doa_azimuth_deg.toFixed(1)}°` : "—",
    },
  ];

  return (
    <div
      style={{
        background: theme.colors.surface,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: "10px",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: `${theme.spacing.md} ${theme.spacing.lg}`,
          borderBottom: `1px solid ${theme.colors.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: "14px", color: theme.colors.textPrimary }}>
          Recent RF Detections
        </span>
        <span style={{ fontSize: "12px", color: theme.colors.textMuted }}>
          {sorted.length} of {detections.length}
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "auto",
          }}
        >
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.label}
                  style={thStyle}
                  onClick={() => {
                    if (col.key) dispatchSort({ key: col.key });
                  }}
                >
                  {col.label}
                  {col.key && (
                    <SortIcon active={sort.key === col.key} dir={sort.dir} />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ ...tdStyle, color: theme.colors.textSecondary, textAlign: "center", padding: theme.spacing.lg }}
                >
                  No detections available.
                </td>
              </tr>
            ) : (
              sorted.map((d) => (
                <tr
                  key={d.id}
                  style={{
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.background = theme.colors.surfaceAlt;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
                  }}
                >
                  {columns.map((col) => (
                    <td key={col.label} style={tdStyle}>
                      {col.render(d)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
