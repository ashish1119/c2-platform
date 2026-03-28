import { useTheme } from "../../../context/ThemeContext";
import type { ExtendedKPIs, InsightItem } from "../state/useTelecomAnalytics";
import { TrendingUp, Wifi, Shield, Clock, MapPin } from "lucide-react";

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const LEVEL_STYLES = {
  critical: { bg: "rgba(239,68,68,0.12)", border: "#EF4444", text: "#EF4444", dot: "#EF4444" },
  warning:  { bg: "rgba(245,158,11,0.10)", border: "#F59E0B", text: "#F59E0B", dot: "#F59E0B" },
  info:     { bg: "rgba(17,193,202,0.08)", border: "rgba(17,193,202,0.4)", text: "#11C1CA", dot: "#11C1CA" },
};

function InsightCard({ item }: { item: InsightItem }) {
  const { theme } = useTheme();
  const s = LEVEL_STYLES[item.level];

  return (
    <div
      style={{
        background: s.bg,
        border: `1px solid ${s.border}40`,
        borderLeft: `3px solid ${s.border}`,
        borderRadius: 8,
        padding: "10px 14px",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: s.text, marginBottom: 2 }}>
          {item.title}
        </div>
        <div style={{ fontSize: 11, color: theme.colors.textSecondary, lineHeight: 1.5 }}>
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
    <div
      style={{
        flex: 1,
        minWidth: 130,
        background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.8)",
        border: `1px solid ${accent}30`,
        borderRadius: 10,
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: `${accent}18`,
          border: `1px solid ${accent}35`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: accent,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 9, color: theme.colors.textMuted, letterSpacing: "0.5px", fontWeight: 600 }}>
          {label}
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: theme.colors.textPrimary, lineHeight: 1.2 }}>
          {value}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 2,
          background: accent,
          opacity: 0.6,
        }}
      />
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
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 4,
            height: 20,
            background: criticalCount > 0
              ? "linear-gradient(to bottom, #EF4444, #F59E0B)"
              : "linear-gradient(to bottom, #22C55E, #11C1CA)",
            borderRadius: 2,
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 700, color: theme.colors.textPrimary, letterSpacing: "0.5px" }}>
          INTELLIGENCE INSIGHTS
        </span>
        {criticalCount > 0 && (
          <span
            style={{
              background: "rgba(239,68,68,0.15)",
              color: "#EF4444",
              border: "1px solid #EF444440",
              borderRadius: 20,
              padding: "1px 8px",
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            {criticalCount} CRITICAL
          </span>
        )}
        {warningCount > 0 && (
          <span
            style={{
              background: "rgba(245,158,11,0.12)",
              color: "#F59E0B",
              border: "1px solid #F59E0B40",
              borderRadius: 20,
              padding: "1px 8px",
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            {warningCount} WARNING
          </span>
        )}
        <span style={{ fontSize: 11, color: theme.colors.textMuted, marginLeft: "auto" }}>
          {totalRecords} records analysed
        </span>
      </div>

      {/* Extended KPI row */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <ExtKPICard icon={<Clock size={16} />}     label="AVG DURATION"       value={formatDuration(extKPIs.avgDurationSec)} accent="#F59E0B" />
        <ExtKPICard icon={<Wifi size={16} />}      label="TOP OPERATOR"       value={extKPIs.mostActiveOperator}              accent="#3B82F6" />
        <ExtKPICard icon={<TrendingUp size={16} />} label="TOP NETWORK"       value={extKPIs.mostUsedNetwork}                 accent="#11C1CA" />
        <ExtKPICard icon={<Shield size={16} />}    label="SUSPICIOUS %"       value={`${extKPIs.suspiciousPct}%`}             accent="#EF4444" />
        <ExtKPICard icon={<MapPin size={16} />}    label="UNIQUE LOCATIONS"   value={extKPIs.uniqueLocations}                 accent="#22C55E" />
        <ExtKPICard icon={<Clock size={16} />}     label="NIGHT ACTIVITY"     value={extKPIs.nightActivityCount}              accent="#8B5CF6" />
      </div>

      {/* Insight cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 8,
        }}
      >
        {insights.map((item) => (
          <InsightCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
