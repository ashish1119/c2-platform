import type { CSSProperties, MouseEvent } from "react";
import { useTheme } from "../../../context/ThemeContext";
import type { SortDir, SortKey, TelecomRecord } from "../model";
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, AlertTriangle, Eye } from "lucide-react";

type Props = {
  rows: TelecomRecord[];
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  onPageChange: (p: number) => void;
  tableSearch: string;
  onTableSearch: (v: string) => void;
  onSelect: (id: string) => void;
  selectedId: string | null;
  onFocusTarget?: (number: string) => void;
};

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

const COLS: { key: SortKey; label: string; width?: number }[] = [
  { key: "startTime", label: "Date / Time", width: 130 },
  { key: "msisdn", label: "MSISDN", width: 130 },
  { key: "target", label: "Target", width: 130 },
  { key: "callType", label: "Type", width: 70 },
  { key: "duration", label: "Duration", width: 80 },
  { key: "endTime", label: "End Time", width: 110 },
  { key: "place", label: "Place", width: 120 },
  { key: "latitude", label: "Lat", width: 80 },
  { key: "longitude", label: "Lng", width: 80 },
  { key: "smsStatus", label: "SMS Status", width: 90 },
  { key: "fake", label: "Fake", width: 60 },
  { key: "silentCallType", label: "Silent", width: 70 },
];

export default function TelecomTable({
  rows,
  total,
  page,
  totalPages,
  pageSize,
  sortKey,
  sortDir,
  onSort,
  onPageChange,
  tableSearch,
  onTableSearch,
  onSelect,
  selectedId,
  onFocusTarget,
}: Props) {
  const { theme } = useTheme();
  const isDark = theme.mode === "dark";

  const glass: CSSProperties = {
    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.75)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(17,193,202,0.35)",
    borderRadius: 10,
  };

  function SortIcon({ col }: { col: SortKey }) {
    if (col !== sortKey) return <ChevronsUpDown size={12} style={{ opacity: 0.3 }} />;
    return sortDir === "asc" ? <ChevronUp size={12} color="#11C1CA" /> : <ChevronDown size={12} color="#11C1CA" />;
  }

  return (
    <div style={{ ...glass, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Table header bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderBottom: `1px solid ${theme.colors.border}30`,
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: "#11C1CA", letterSpacing: "0.8px" }}>
          COMMUNICATION LOGS — {total} records
        </div>
        <div style={{ position: "relative" }}>
          <Search size={13} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: theme.colors.textMuted }} />
          <input
            type="text"
            value={tableSearch}
            onChange={(e) => onTableSearch(e.target.value)}
            placeholder="Search table..."
            style={{
              background: theme.colors.surfaceAlt,
              color: theme.colors.textPrimary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.md,
              padding: "5px 10px 5px 28px",
              fontSize: 12,
              width: 180,
            }}
          />
        </div>
      </div>

      {/* Scrollable table */}
      <div style={{ overflowX: "auto", flex: 1 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}>
              {COLS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => onSort(col.key)}
                  style={{
                    padding: "8px 10px",
                    textAlign: "left",
                    fontWeight: 600,
                    fontSize: 10,
                    letterSpacing: "0.5px",
                    color: sortKey === col.key ? "#11C1CA" : theme.colors.textSecondary,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    borderBottom: `1px solid ${theme.colors.border}30`,
                    minWidth: col.width,
                    userSelect: "none",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {col.label}
                    <SortIcon col={col.key} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isSuspicious = r.fake || r.silentCallType !== "None";
              const isSelected = r.id === selectedId;
              return (
                <tr
                  key={r.id}
                  onClick={() => onSelect(r.id)}
                  style={{
                    cursor: "pointer",
                    background: isSelected
                      ? "rgba(59,130,246,0.12)"
                      : isSuspicious
                      ? "rgba(239,68,68,0.06)"
                      : "transparent",
                    borderLeft: isSelected
                      ? "3px solid #3B82F6"
                      : isSuspicious
                      ? "3px solid #EF4444"
                      : "3px solid transparent",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e: MouseEvent<HTMLTableRowElement>) => {
                    if (!isSelected) e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)";
                  }}
                  onMouseLeave={(e: MouseEvent<HTMLTableRowElement>) => {
                    if (!isSelected) e.currentTarget.style.background = isSuspicious ? "rgba(239,68,68,0.06)" : "transparent";
                  }}
                >
                  <td style={{ padding: "7px 10px", color: theme.colors.textSecondary, whiteSpace: "nowrap" }}>
                    {formatTime(r.startTime)}
                  </td>
                  <td style={{ padding: "7px 10px", fontWeight: 600, color: theme.colors.textPrimary, whiteSpace: "nowrap" }}>
                    {r.msisdn}
                  </td>
                  <td style={{ padding: "7px 10px", color: theme.colors.textPrimary, whiteSpace: "nowrap" }}>
                    {r.target ? (
                      <span
                        onClick={(e: MouseEvent) => { e.stopPropagation(); onFocusTarget?.(r.target); }}
                        style={{
                          cursor: onFocusTarget ? "pointer" : "default",
                          color: onFocusTarget ? "#22C55E" : theme.colors.textPrimary,
                          fontWeight: 600,
                          textDecoration: onFocusTarget ? "underline dotted" : "none",
                        }}
                        title={onFocusTarget ? `Click to analyse ${r.target}` : undefined}
                      >
                        {r.target}
                      </span>
                    ) : "—"}
                  </td>
                  <td style={{ padding: "7px 10px" }}>
                    <span
                      style={{
                        padding: "2px 7px",
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        background:
                          r.callType === "Voice"
                            ? "rgba(59,130,246,0.15)"
                            : r.callType === "SMS"
                            ? "rgba(17,193,202,0.15)"
                            : "rgba(245,158,11,0.15)",
                        color:
                          r.callType === "Voice" ? "#3B82F6" : r.callType === "SMS" ? "#11C1CA" : "#F59E0B",
                      }}
                    >
                      {r.callType}
                    </span>
                  </td>
                  <td style={{ padding: "7px 10px", color: theme.colors.textSecondary }}>
                    {formatDuration(r.duration)}
                  </td>
                  <td style={{ padding: "7px 10px", color: theme.colors.textSecondary, whiteSpace: "nowrap" }}>
                    {formatTime(r.endTime)}
                  </td>
                  <td style={{ padding: "7px 10px", color: theme.colors.textSecondary }}>{r.place || "—"}</td>
                  <td style={{ padding: "7px 10px", color: theme.colors.textMuted }}>{r.latitude?.toFixed(4)}</td>
                  <td style={{ padding: "7px 10px", color: theme.colors.textMuted }}>{r.longitude?.toFixed(4)}</td>
                  <td style={{ padding: "7px 10px" }}>
                    {r.smsStatus ? (
                      <span style={{ color: r.smsStatus === "Delivered" ? theme.colors.success : theme.colors.danger, fontWeight: 600 }}>
                        {r.smsStatus}
                      </span>
                    ) : "—"}
                  </td>
                  <td style={{ padding: "7px 10px" }}>
                    {r.fake ? (
                      <span style={{ color: theme.colors.danger, fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}>
                        <AlertTriangle size={11} /> Yes
                      </span>
                    ) : (
                      <span style={{ color: theme.colors.textMuted }}>No</span>
                    )}
                  </td>
                  <td style={{ padding: "7px 10px" }}>
                    <span
                      style={{
                        color:
                          r.silentCallType === "Spy"
                            ? theme.colors.warning
                            : r.silentCallType === "Ping"
                            ? theme.colors.info
                            : theme.colors.textMuted,
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                        fontWeight: r.silentCallType !== "None" ? 700 : 400,
                      }}
                    >
                      {r.silentCallType === "Spy" && <Eye size={11} />}
                      {r.silentCallType}
                    </span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLS.length} style={{ textAlign: "center", padding: 32, color: theme.colors.textMuted }}>
                  No records match current filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 14px",
          borderTop: `1px solid ${theme.colors.border}30`,
          fontSize: 12,
          color: theme.colors.textSecondary,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <span>
          Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={() => onPageChange(0)}
            disabled={page === 0}
            style={pageBtnStyle(page === 0, theme)}
          >
            «
          </button>
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 0}
            style={pageBtnStyle(page === 0, theme)}
          >
            ‹
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const p = Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
            return (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                style={{
                  ...pageBtnStyle(false, theme),
                  background: p === page ? theme.colors.primary : "transparent",
                  color: p === page ? "#fff" : theme.colors.textSecondary,
                  fontWeight: p === page ? 700 : 400,
                }}
              >
                {p + 1}
              </button>
            );
          })}
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages - 1}
            style={pageBtnStyle(page >= totalPages - 1, theme)}
          >
            ›
          </button>
          <button
            onClick={() => onPageChange(totalPages - 1)}
            disabled={page >= totalPages - 1}
            style={pageBtnStyle(page >= totalPages - 1, theme)}
          >
            »
          </button>
        </div>
      </div>
    </div>
  );
}

function pageBtnStyle(disabled: boolean, theme: any): CSSProperties {
  return {
    padding: "3px 8px",
    borderRadius: 4,
    border: `1px solid ${theme.colors.border}`,
    background: "transparent",
    color: disabled ? theme.colors.textMuted : theme.colors.textSecondary,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 12,
    opacity: disabled ? 0.4 : 1,
  };
}
