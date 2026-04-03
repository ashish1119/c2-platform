import { useState } from "react";
import { useTheme } from "../../../context/ThemeContext";
import type { DayGroup, TelecomRecord } from "../model";
import { Phone, MessageSquare, AlertTriangle, ChevronDown, ChevronRight, Eye } from "lucide-react";

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
      weekday: "short", day: "numeric", month: "short", year: "numeric",
    });
  } catch { return dateStr; }
}

function CallRow({ r }: { r: TelecomRecord }) {
  const { theme } = useTheme();
  const isSuspicious = r.fake || r.silentCallType !== "None";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "60px 130px 130px 60px 70px 100px 1fr",
        gap: 8,
        padding: "6px 12px",
        fontSize: 12,
        borderRadius: 6,
        background: isSuspicious ? `${theme.colors.danger}10` : "transparent",
        borderLeft: isSuspicious ? `2px solid ${theme.colors.danger}` : "2px solid transparent",
        alignItems: "center",
      }}
    >
      <span style={{ color: theme.colors.textMuted }}>{formatTime(r.startTime)}</span>
      <span style={{ fontWeight: 600 }}>{r.msisdn}</span>
      <span style={{ color: theme.colors.textSecondary }}>{r.target || "—"}</span>
      <span>
        <span
          style={{
            padding: "1px 6px",
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 700,
            background: r.callType === "Voice" ? "rgba(59,130,246,0.15)" : "rgba(17,193,202,0.15)",
            color: r.callType === "Voice" ? "#3B82F6" : "#11C1CA",
          }}
        >
          {r.callType}
        </span>
      </span>
      <span style={{ color: theme.colors.textSecondary }}>{formatDuration(r.duration)}</span>
      <span style={{ color: theme.colors.textMuted }}>{r.place || "—"}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {r.fake && (
          <span style={{ color: theme.colors.danger, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", gap: 2 }}>
            <AlertTriangle size={10} /> FAKE
          </span>
        )}
        {r.silentCallType !== "None" && (
          <span style={{ color: theme.colors.warning, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", gap: 2 }}>
            <Eye size={10} /> {r.silentCallType}
          </span>
        )}
      </span>
    </div>
  );
}

function DayCard({ group }: { group: DayGroup }) {
  const { theme } = useTheme();
  const isDark = theme.mode === "dark";
  const [expanded, setExpanded] = useState(false);
  const suspicious = group.records.filter((r) => r.fake || r.silentCallType !== "None").length;

  return (
    <div
      style={{
        background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)",
        border: suspicious > 0 ? `1px solid ${theme.colors.danger}40` : "1px solid rgba(17,193,202,0.25)",
        borderRadius: 10,
        overflow: "hidden",
        marginBottom: 8,
      }}
    >
      {/* Day header */}
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          cursor: "pointer",
          background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
          userSelect: "none",
        }}
      >
        {expanded ? <ChevronDown size={16} color="#11C1CA" /> : <ChevronRight size={16} color={theme.colors.textMuted} />}

        <div style={{ fontWeight: 700, fontSize: 14, color: theme.colors.textPrimary }}>
          {formatDate(group.date)}
        </div>

        <div style={{ display: "flex", gap: 16, marginLeft: "auto", flexWrap: "wrap" }}>
          <Stat label="Calls" value={group.callCount} color="#3B82F6" />
          <Stat label="Duration" value={formatDuration(group.totalDuration)} color="#11C1CA" />
          <Stat label="Contacts" value={group.uniqueTargets} color="#22C55E" />
          {suspicious > 0 && <Stat label="Suspicious" value={suspicious} color="#EF4444" />}
        </div>
      </div>

      {/* Expanded rows */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${theme.colors.border}20` }}>
          {/* Column headers */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "60px 130px 130px 60px 70px 100px 1fr",
              gap: 8,
              padding: "6px 12px",
              fontSize: 10,
              color: theme.colors.textMuted,
              letterSpacing: "0.5px",
              fontWeight: 600,
              borderBottom: `1px solid ${theme.colors.border}20`,
            }}
          >
            <span>TIME</span>
            <span>MSISDN</span>
            <span>TARGET</span>
            <span>TYPE</span>
            <span>DURATION</span>
            <span>PLACE</span>
            <span>FLAGS</span>
          </div>
          {group.records.map((r) => (
            <CallRow key={r.id} r={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: "#64748B", letterSpacing: "0.3px" }}>{label}</div>
    </div>
  );
}

export default function TelecomTimeline({ dayGroups }: { dayGroups: DayGroup[] }) {
  const { theme } = useTheme();

  if (dayGroups.length === 0) {
    return (
      <div style={{ textAlign: "center", color: theme.colors.textMuted, padding: 40, fontSize: 14 }}>
        No data for selected filters
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#11C1CA", letterSpacing: "0.8px", marginBottom: 12 }}>
        DAY-WISE ACTIVITY — {dayGroups.length} days
      </div>
      {dayGroups.map((g) => (
        <DayCard key={g.date} group={g} />
      ))}
    </div>
  );
}
