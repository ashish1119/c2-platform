import React from "react";
import { useTheme } from "../../../context/ThemeContext";
import type { ExtendedKPIs, InsightItem } from "../state/useTelecomAnalytics";
import { TrendingUp, Wifi, Shield, Clock, MapPin, Moon, Brain, Phone, Activity } from "lucide-react";

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const LEVEL_STYLES = {
  critical: {
    bg: "rgba(239,68,68,0.1)",
    border: "#EF4444",
    text: "#EF4444",
    label: "CRITICAL",
    labelBg: "rgba(239,68,68,0.15)",
  },
  warning: {
    bg: "rgba(245,158,11,0.08)",
    border: "#F59E0B",
    text: "#F59E0B",
    label: "WARNING",
    labelBg: "rgba(245,158,11,0.12)",
  },
  info: {
    bg: "rgba(17,193,202,0.06)",
    border: "rgba(17,193,202,0.5)",
    text: "#11C1CA",
    label: "INFO",
    labelBg: "rgba(17,193,202,0.1)",
  },
};

function InsightCard({ item }: { item: InsightItem }) {
  const { theme } = useTheme();
  const s = LEVEL_STYLES[item.level];

  return (
    <div style={{
      background: s.bg,
      border: `1px solid ${s.border}35`,
      borderLeft: `3px solid ${s.border}`,
      borderRadius: 10,
      padding: "12px 16px",
      display: "flex",
      gap: 12,
      alignItems: "flex-start",
      transition: "transform 0.15s ease",
    }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateX(2px)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateX(0)"; }}
    >
      <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: s.text }}>{item.title}</div>
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: "0.6px",
            color: s.text, background: s.labelBg,
            border: `1px solid ${s.border}30`,
            padding: "1px 6px", borderRadius: 4,
          }}>
            {s.label}
          </span>
        </div>
        <div style={{ fontSize: 11, color: theme.colors.textSecondary, lineHeight: 1.6 }}>
          {item.detail}
        </div>
      </div>
    </div>
  );
}

function ExtKPICard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent: string;
}) {
  const { theme } = useTheme();
  const isDark = theme.mode === "dark";

  return (
    <div style={{
      flex: 1,
      minWidth: 130,
      background: isDark
        ? `linear-gradient(135deg, ${accent}10, rgba(255,255,255,0.02))`
        : `linear-gradient(135deg, ${accent}08, rgba(255,255,255,0.9))`,
      border: `1.5px solid ${accent}28`,
      borderRadius: 10,
      padding: "12px 16px",
      display: "flex",
      alignItems: "center",
      gap: 10,
      position: "relative",
      overflow: "hidden",
      transition: "transform 0.15s ease, box-shadow 0.15s ease",
      boxShadow: `0 2px 12px ${accent}15`,
    }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 6px 20px ${accent}25`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 2px 12px ${accent}15`;
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: `${accent}18`,
        border: `1px solid ${accent}35`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: accent, flexShrink: 0,
        boxShadow: `0 0 8px ${accent}25`,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 9, color: theme.colors.textMuted, letterSpacing: "0.6px", fontWeight: 700, textTransform: "uppercase" }}>
          {label}
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: theme.colors.textPrimary, lineHeight: 1.2, marginTop: 2 }}>
          {value}
        </div>
      </div>
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${accent}, ${accent}30)`,
      }} />
    </div>
  );
}

type Props = {
  insights: InsightItem[];
  extKPIs: ExtendedKPIs;
  totalRecords: number;
};

export default function TelecomAIInsights({ insights, extKPIs, totalRecords }: Props) {
  const { theme } = useTheme();
  const isDark = theme.mode === "dark";

  const criticalCount = insights.filter((i) => i.level === "critical").length;
  const warningCount = insights.filter((i) => i.level === "warning").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ── Section header ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 16px",
        background: isDark
          ? criticalCount > 0 ? "rgba(239,68,68,0.07)" : "rgba(17,193,202,0.05)"
          : criticalCount > 0 ? "rgba(239,68,68,0.05)" : "rgba(17,193,202,0.04)",
        border: `1px solid ${criticalCount > 0 ? "rgba(239,68,68,0.25)" : "rgba(17,193,202,0.2)"}`,
        borderRadius: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: criticalCount > 0 ? "rgba(239,68,68,0.15)" : "rgba(17,193,202,0.12)",
          border: `1px solid ${criticalCount > 0 ? "rgba(239,68,68,0.4)" : "rgba(17,193,202,0.35)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: criticalCount > 0 ? "#EF4444" : "#11C1CA",
        }}>
          <Brain size={16} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: theme.colors.textPrimary, letterSpacing: "0.4px" }}>
            BEHAVIORAL INSIGHTS
          </div>
          <div style={{ fontSize: 10, color: theme.colors.textMuted, marginTop: 1 }}>
            AI-generated intelligence from {totalRecords} records
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          {criticalCount > 0 && (
            <span style={{
              background: "rgba(239,68,68,0.15)", color: "#EF4444",
              border: "1px solid rgba(239,68,68,0.4)",
              borderRadius: 20, padding: "2px 10px",
              fontSize: 10, fontWeight: 800, letterSpacing: "0.5px",
              boxShadow: "0 0 8px rgba(239,68,68,0.2)",
            }}>
              {criticalCount} CRITICAL
            </span>
          )}
          {warningCount > 0 && (
            <span style={{
              background: "rgba(245,158,11,0.12)", color: "#F59E0B",
              border: "1px solid rgba(245,158,11,0.4)",
              borderRadius: 20, padding: "2px 10px",
              fontSize: 10, fontWeight: 800, letterSpacing: "0.5px",
            }}>
              {warningCount} WARNING
            </span>
          )}
        </div>
      </div>

      {/* ── Advanced Metrics row ── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <ExtKPICard icon={<Clock size={16} />}      label="Avg Duration"       value={formatDuration(extKPIs.avgDurationSec)} accent="#F59E0B" />
        <ExtKPICard icon={<Wifi size={16} />}       label="Top Operator"       value={extKPIs.mostActiveOperator}              accent="#3B82F6" />
        <ExtKPICard icon={<TrendingUp size={16} />} label="Top Network"        value={extKPIs.mostUsedNetwork}                 accent="#11C1CA" />
        <ExtKPICard icon={<Shield size={16} />}     label="Suspicious %"       value={`${extKPIs.suspiciousPct}%`}             accent="#EF4444" />
        <ExtKPICard icon={<MapPin size={16} />}     label="Unique Locations"   value={extKPIs.uniqueLocations}                 accent="#22C55E" />
        <ExtKPICard icon={<Moon size={16} />}       label="Night Activity"     value={extKPIs.nightActivityCount}              accent="#8B5CF6" />
        <ExtKPICard icon={<Activity size={16} />}   label="Peak Hour"          value={extKPIs.peakHour !== null ? `${extKPIs.peakHour}:00 (${extKPIs.peakHourCount})` : "—"} accent="#F97316" />
        <ExtKPICard icon={<Phone size={16} />}      label="Most Contacted"     value={extKPIs.mostContactedNumber !== "—" ? `${extKPIs.mostContactedNumber.slice(-8)} (${extKPIs.mostContactedCount})` : "—"} accent="#EC4899" />
      </div>

      {/* ── Insight cards ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: 8,
      }}>
        {insights.map((item) => (
          <InsightCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
