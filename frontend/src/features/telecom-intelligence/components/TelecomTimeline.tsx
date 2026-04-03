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
  const isDark = theme.mode === "dark";
  const isSuspicious = r.fake || r.silentCallType !== "None";

  const typeColor = r.callType === "Voice" ? "#3B82F6" : r.callType === "SMS" ? "#00E5FF" : "#F59E0B";
  const typeIcon = r.callType === "Voice" ? <Phone size={10} /> : r.callType === "SMS" ? <MessageSquare size={10} /> : null;

  return (
    <div
      className="intel-row"
      style={{
        display: "grid",
        gridTemplateColumns: "60px 130px 130px 70px 70px 100px 1fr",
        gap: 8,
        padding: "7px 16px 7px 40px",
        fontSize: 12,
        borderRadius: 6,
        background: isSuspicious
          ? isDark ? "rgba(255,77,79,0.07)" : "rgba(220,38,38,0.05)"
          : "transparent",
        borderLeft: isSuspicious ? `2px solid ${theme.colors.danger}` : "2px solid transparent",
        alignItems: "center",
        transition: "background 0.15s ease",
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = isDark
          ? "rgba(0,229,255,0.05)"
          : "rgba(0,112,243,0.04)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = isSuspicious
          ? isDark ? "rgba(255,77,79,0.07)" : "rgba(220,38,38,0.05)"
          : "transparent";
      }}
    >
      <span style={{ color: theme.colors.textMuted, fontFamily: "monospace", fontSize: 11 }}>
        {formatTime(r.startTime)}
      </span>
      <span style={{ fontWeight: 600, color: theme.colors.textPrimary }}>{r.msisdn}</span>
      <span style={{ color: theme.colors.textSecondary }}>{r.target || "—"}</span>
      <span>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 700,
          background: `${typeColor}18`, color: typeColor,
          border: `1px solid ${typeColor}30`,
        }}>
          {typeIcon}{r.callType}
        </span>
      </span>
      <span style={{ color: theme.colors.textSecondary, fontFamily: "monospace", fontSize: 11 }}>
        {formatDuration(r.duration)}
      </span>
      <span style={{ color: theme.colors.textMuted, fontSize: 11 }}>{r.place || "—"}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {r.fake && (
          <span style={{
            color: theme.colors.danger, fontSize: 10, fontWeight: 700,
            display: "flex", alignItems: "center", gap: 2,
            background: `${theme.colors.danger}15`, padding: "1px 6px", borderRadius: 4,
          }}>
            <AlertTriangle size={10} /> FAKE
          </span>
        )}
        {r.silentCallType !== "None" && (
          <span style={{
            color: theme.colors.warning, fontSize: 10, fontWeight: 700,
            display: "flex", alignItems: "center", gap: 2,
            background: `${theme.colors.warning}15`, padding: "1px 6px", borderRadius: 4,
          }}>
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
  const hasSuspicious = suspicious > 0;

  return (
    <div
      className="intel-card"
      style={{
        background: isDark
          ? "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))"
          : "rgba(255,255,255,0.85)",
        backdropFilter: "blur(12px)",
        border: hasSuspicious
          ? `1px solid ${theme.colors.danger}45`
          : `1px solid rgba(0,229,255,0.2)`,
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 10,
        boxShadow: isDark
          ? hasSuspicious
            ? `0 4px 20px rgba(255,77,79,0.1)`
            : "0 4px 16px rgba(0,0,0,0.2)"
          : "0 2px 12px rgba(0,0,0,0.06)",
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
          background: isDark
            ? hasSuspicious
              ? "rgba(255,77,79,0.06)"
              : "rgba(0,229,255,0.04)"
            : hasSuspicious
            ? "rgba(220,38,38,0.04)"
            : "rgba(0,112,243,0.03)",
          userSelect: "none",
          transition: "background 0.15s ease",
        }}
      >
        {/* Animated timeline dot */}
        <div style={{ position: "relative", width: 14, height: 14, flexShrink: 0 }}>
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            background: hasSuspicious ? theme.colors.danger : theme.colors.primary,
            animation: expanded ? "timelinePulse 2s ease-out infinite" : "none",
          }} />
          <div style={{
            position: "absolute", inset: 2, borderRadius: "50%",
            background: hasSuspicious ? theme.colors.danger : theme.colors.primary,
          }} />
        </div>

        {expanded
          ? <ChevronDown size={15} color={theme.colors.primary} />
          : <ChevronRight size={15} color={theme.colors.textMuted} />}

        <div style={{ fontWeight: 700, fontSize: 13, color: theme.colors.textPrimary }}>
          {formatDate(group.date)}
        </div>

        <div style={{ display: "flex", gap: 14, marginLeft: "auto", flexWrap: "wrap", alignItems: "center" }}>
          <Stat label="Calls" value={group.callCount} color={theme.colors.primary} />
          <Stat label="Duration" value={formatDuration(group.totalDuration)} color="#22C55E" />
          <Stat label="Contacts" value={group.uniqueTargets} color="#F59E0B" />
          {hasSuspicious && <Stat label="Suspicious" value={suspicious} color={theme.colors.danger} />}
        </div>
      </div>

      {/* Expanded rows */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${theme.colors.border}30`, animation: "fadeIn 0.2s ease" }}>
          {/* Column headers */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "60px 130px 130px 70px 70px 100px 1fr",
            gap: 8,
            padding: "6px 16px 6px 40px",
            fontSize: 10,
            color: theme.colors.textMuted,
            letterSpacing: "0.7px",
            fontWeight: 700,
            borderBottom: `1px solid ${theme.colors.border}20`,
            textTransform: "uppercase",
          }}>
            <span>Time</span>
            <span>MSISDN</span>
            <span>Target</span>
            <span>Type</span>
            <span>Duration</span>
            <span>Place</span>
            <span>Flags</span>
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
    <div style={{
      textAlign: "center",
      padding: "4px 10px",
      borderRadius: 8,
      background: `${color}12`,
      border: `1px solid ${color}25`,
      minWidth: 56,
    }}>
      <div style={{ fontSize: 15, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 9, color: "#64748B", letterSpacing: "0.4px", marginTop: 2, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

export default function TelecomTimeline({ dayGroups }: { dayGroups: DayGroup[] }) {
  const { theme } = useTheme();

  if (dayGroups.length === 0) {
    return (
      <div style={{
        textAlign: "center", color: theme.colors.textMuted,
        padding: 48, fontSize: 13,
        background: theme.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
        borderRadius: 12, border: `1px solid ${theme.colors.border}`,
      }}>
        No activity data for selected filters
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
        padding: "8px 14px",
        background: theme.mode === "dark" ? "rgba(0,229,255,0.05)" : "rgba(0,112,243,0.04)",
        border: `1px solid rgba(0,229,255,0.15)`,
        borderRadius: 8,
      }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: theme.colors.primary, boxShadow: `0 0 6px ${theme.colors.primary}` }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: theme.colors.primary, letterSpacing: "1px" }}>
          ACTIVITY TIMELINE
        </span>
        <span style={{
          fontSize: 10, color: theme.colors.textMuted,
          background: theme.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
          padding: "1px 8px", borderRadius: 10, fontWeight: 600,
        }}>
          {dayGroups.length} days
        </span>
      </div>

      {/* Vertical timeline line */}
      <div style={{ position: "relative" }}>
        <div style={{
          position: "absolute",
          left: 6, top: 0, bottom: 0, width: 2,
          background: `linear-gradient(to bottom, ${theme.colors.primary}60, transparent)`,
          borderRadius: 1,
        }} />
        <div style={{ paddingLeft: 20 }}>
          {dayGroups.map((g) => (
            <DayCard key={g.date} group={g} />
          ))}
        </div>
      </div>
    </div>
  );
}
