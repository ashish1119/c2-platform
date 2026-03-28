import { useTheme } from "../../../context/ThemeContext";
import type { TelecomRecord } from "../model";
import { Phone, MessageSquare, AlertTriangle, Eye, User } from "lucide-react";

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

type Props = {
  records: TelecomRecord[];
  selectedRecord: TelecomRecord | null;
  onSelect: (id: string) => void;
  onFocusTarget?: (number: string) => void;
};

export default function TelecomCallerPanel({ records, selectedRecord, onSelect, onFocusTarget }: Props) {
  const { theme } = useTheme();
  const isDark = theme.mode === "dark";

  const glass: React.CSSProperties = {
    background: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.75)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(17,193,202,0.35)",
    borderRadius: 10,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      {/* Profile */}
      {selectedRecord && (
        <div style={{ ...glass, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(59,130,246,0.2)", border: "2px solid #3B82F6", display: "flex", alignItems: "center", justifyContent: "center", color: "#3B82F6", flexShrink: 0 }}>
              <User size={20} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selectedRecord.name || selectedRecord.msisdn}
              </div>
              <div style={{ fontSize: 11, color: theme.colors.textSecondary }}>{selectedRecord.msisdn}</div>
            </div>
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
              {selectedRecord.fake && (
                <span style={{ background: `${theme.colors.danger}20`, color: theme.colors.danger, border: `1px solid ${theme.colors.danger}`, borderRadius: 5, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>
                  FAKE
                </span>
              )}
              {selectedRecord.silentCallType === "Spy" && (
                <span style={{ background: `${theme.colors.warning}20`, color: theme.colors.warning, border: `1px solid ${theme.colors.warning}`, borderRadius: 5, padding: "1px 6px", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", gap: 2 }}>
                  <Eye size={9} /> SPY
                </span>
              )}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11 }}>
            {[
              ["Operator", selectedRecord.operator],
              ["Network", selectedRecord.network],
              ["Band", selectedRecord.band],
              ["Place", selectedRecord.place],
            ].map(([k, v]) => (
              <div key={k}>
                <div style={{ color: theme.colors.textMuted, fontSize: 10 }}>{k}</div>
                <div style={{ fontWeight: 600 }}>{v || "—"}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Log list */}
      <div style={{ ...glass, flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "8px 12px", fontSize: 10, fontWeight: 700, color: "#11C1CA", letterSpacing: "0.8px", borderBottom: `1px solid ${theme.colors.border}20` }}>
          RECORDS ({records.length})
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {records.map((r) => {
            const isSuspicious = r.fake || r.silentCallType !== "None";
            const isSelected = r.id === selectedRecord?.id;
            return (
              <div
                key={r.id}
                onClick={() => onSelect(r.id)}
                style={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  borderLeft: isSelected ? "3px solid #3B82F6" : isSuspicious ? `3px solid ${theme.colors.danger}` : "3px solid transparent",
                  background: isSelected ? "rgba(59,130,246,0.1)" : isSuspicious ? `${theme.colors.danger}08` : "transparent",
                  borderBottom: `1px solid ${theme.colors.border}15`,
                  transition: "background 0.1s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  {r.callType === "Voice" ? <Phone size={11} color="#3B82F6" /> : <MessageSquare size={11} color="#11C1CA" />}
                  <span
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); if (r.target) onFocusTarget?.(r.target); }}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      cursor: onFocusTarget && r.target ? "pointer" : "default",
                      color: onFocusTarget && r.target ? "#22C55E" : theme.colors.textPrimary,
                    }}
                    title={onFocusTarget && r.target ? `Analyse ${r.target}` : undefined}
                  >
                    {r.target || "Unknown"}
                  </span>
                  <span style={{ fontSize: 10, color: theme.colors.textMuted }}>{formatTime(r.startTime)}</span>
                </div>
                <div style={{ display: "flex", gap: 8, fontSize: 10, color: theme.colors.textSecondary }}>
                  <span>{formatDuration(r.duration)}</span>
                  <span>{r.place || r.operator}</span>
                  {r.fake && <span style={{ color: theme.colors.danger, display: "flex", alignItems: "center", gap: 2 }}><AlertTriangle size={9} />Fake</span>}
                  {r.silentCallType !== "None" && <span style={{ color: theme.colors.warning }}>{r.silentCallType}</span>}
                </div>
              </div>
            );
          })}
          {records.length === 0 && (
            <div style={{ textAlign: "center", color: theme.colors.textMuted, padding: 24, fontSize: 13 }}>
              No records
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
