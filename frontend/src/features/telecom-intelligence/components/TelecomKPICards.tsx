import { useTheme } from "../../../context/ThemeContext";
import type { TelecomKPIs } from "../model";
import { Phone, MessageSquare, Users, AlertTriangle, Clock } from "lucide-react";

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${sec % 60}s`;
}

function KPICard({
  label,
  value,
  icon,
  accent,
  alert,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent: string;
  alert?: boolean;
}) {
  const { theme } = useTheme();
  const isDark = theme.mode === "dark";

  return (
    <div
      style={{
        position: "relative",
        flex: 1,
        minWidth: 150,
        background: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.75)",
        backdropFilter: "blur(12px)",
        border: alert ? `1px solid ${theme.colors.danger}60` : "1px solid rgba(17,193,202,0.35)",
        borderRadius: 10,
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        boxShadow: alert
          ? `0 0 14px ${theme.colors.danger}30`
          : "0 4px 16px rgba(0,0,0,0.25)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 10,
          background: `${accent}20`,
          border: `1px solid ${accent}40`,
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
        <div style={{ fontSize: 10, color: theme.colors.textMuted, letterSpacing: "0.5px", fontWeight: 600, marginBottom: 3 }}>
          {label}
        </div>
        <div
          style={{
            fontSize: 26,
            fontWeight: 700,
            lineHeight: 1,
            color: alert ? theme.colors.danger : theme.colors.textPrimary,
          }}
        >
          {value}
        </div>
      </div>
      {/* Bottom accent */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          background: alert ? theme.colors.danger : accent,
          boxShadow: `0 0 8px ${accent}80`,
        }}
      />
    </div>
  );
}

export default function TelecomKPICards({ kpis }: { kpis: TelecomKPIs }) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <KPICard label="TOTAL CALLS" value={kpis.totalCalls} icon={<Phone size={19} />} accent="#3B82F6" />
      <KPICard label="TOTAL SMS" value={kpis.totalSMS} icon={<MessageSquare size={19} />} accent="#11C1CA" />
      <KPICard label="UNIQUE CONTACTS" value={kpis.uniqueContacts} icon={<Users size={19} />} accent="#22C55E" />
      <KPICard label="SUSPICIOUS" value={kpis.suspiciousCount} icon={<AlertTriangle size={19} />} accent="#EF4444" alert={kpis.suspiciousCount > 0} />
      <KPICard label="TOTAL DURATION" value={formatDuration(kpis.totalDurationSec)} icon={<Clock size={19} />} accent="#F59E0B" />
    </div>
  );
}
