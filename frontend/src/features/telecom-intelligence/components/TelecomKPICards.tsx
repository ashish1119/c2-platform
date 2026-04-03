import React from "react";
import { useTheme } from "../../../context/ThemeContext";
import type { TelecomKPIs } from "../model";
import { Phone, MessageSquare, Users, AlertTriangle, Clock } from "lucide-react";

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${sec % 60}s`;
}

const CARD_CONFIGS = [
  {
    key: "totalCalls" as const,
    label: "TOTAL CALLS",
    icon: Phone,
    accent: "#3B82F6",
    gradient: "linear-gradient(135deg, rgba(59,130,246,0.18) 0%, rgba(59,130,246,0.06) 100%)",
    glowColor: "rgba(59,130,246,0.25)",
  },
  {
    key: "totalSMS" as const,
    label: "TOTAL SMS",
    icon: MessageSquare,
    accent: "#11C1CA",
    gradient: "linear-gradient(135deg, rgba(17,193,202,0.18) 0%, rgba(17,193,202,0.06) 100%)",
    glowColor: "rgba(17,193,202,0.25)",
  },
  {
    key: "uniqueContacts" as const,
    label: "UNIQUE CONTACTS",
    icon: Users,
    accent: "#22C55E",
    gradient: "linear-gradient(135deg, rgba(34,197,94,0.18) 0%, rgba(34,197,94,0.06) 100%)",
    glowColor: "rgba(34,197,94,0.25)",
  },
  {
    key: "suspiciousCount" as const,
    label: "SUSPICIOUS",
    icon: AlertTriangle,
    accent: "#EF4444",
    gradient: "linear-gradient(135deg, rgba(239,68,68,0.22) 0%, rgba(239,68,68,0.08) 100%)",
    glowColor: "rgba(239,68,68,0.35)",
    alert: true,
  },
  {
    key: "totalDurationSec" as const,
    label: "TOTAL DURATION",
    icon: Clock,
    accent: "#F59E0B",
    gradient: "linear-gradient(135deg, rgba(245,158,11,0.18) 0%, rgba(245,158,11,0.06) 100%)",
    glowColor: "rgba(245,158,11,0.25)",
  },
];

function KPICard({
  label,
  value,
  icon: Icon,
  accent,
  gradient,
  glowColor,
  alert,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent: string;
  gradient: string;
  glowColor: string;
  alert?: boolean;
}) {
  const { theme } = useTheme();
  const isDark = theme.mode === "dark";

  return (
    <div
      style={{
        position: "relative",
        flex: 1,
        minWidth: 155,
        background: gradient,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: `1.5px solid ${accent}${alert ? "60" : "35"}`,
        borderRadius: 12,
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        boxShadow: alert
          ? `0 0 20px ${glowColor}, 0 4px 16px rgba(0,0,0,0.2)`
          : `0 0 14px ${glowColor}, 0 4px 16px rgba(0,0,0,0.15)`,
        overflow: "hidden",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "scale(1.03)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 28px ${glowColor}, 0 8px 24px rgba(0,0,0,0.25)`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "scale(1)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = alert
          ? `0 0 20px ${glowColor}, 0 4px 16px rgba(0,0,0,0.2)`
          : `0 0 14px ${glowColor}, 0 4px 16px rgba(0,0,0,0.15)`;
      }}
    >
      {/* Icon box */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: `${accent}22`,
          border: `1.5px solid ${accent}50`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: accent,
          flexShrink: 0,
          boxShadow: `0 0 10px ${accent}30`,
        }}
      >
        <Icon size={20} />
      </div>

      {/* Text */}
      <div>
        <div style={{
          fontSize: 10,
          color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)",
          letterSpacing: "0.8px",
          fontWeight: 700,
          marginBottom: 4,
          textTransform: "uppercase",
        }}>
          {label}
        </div>
        <div style={{
          fontSize: 28,
          fontWeight: 800,
          lineHeight: 1,
          color: alert ? accent : theme.colors.textPrimary,
          letterSpacing: "-0.5px",
          textShadow: alert ? `0 0 12px ${accent}60` : "none",
        }}>
          {value}
        </div>
      </div>

      {/* Bottom accent bar */}
      <div style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 3,
        background: `linear-gradient(90deg, ${accent}, ${accent}40)`,
        boxShadow: `0 0 10px ${accent}80`,
      }} />

      {/* Top-right corner glow */}
      <div style={{
        position: "absolute",
        top: -20,
        right: -20,
        width: 60,
        height: 60,
        borderRadius: "50%",
        background: `${accent}15`,
        filter: "blur(12px)",
        pointerEvents: "none",
      }} />
    </div>
  );
}

export default function TelecomKPICards({ kpis }: { kpis: TelecomKPIs }) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {CARD_CONFIGS.map((cfg) => {
        const rawValue = kpis[cfg.key];
        const displayValue = cfg.key === "totalDurationSec"
          ? formatDuration(rawValue as number)
          : rawValue;
        const isAlert = cfg.alert && (rawValue as number) > 0;
        return (
          <KPICard
            key={cfg.key}
            label={cfg.label}
            value={displayValue}
            icon={cfg.icon}
            accent={cfg.accent}
            gradient={cfg.gradient}
            glowColor={cfg.glowColor}
            alert={isAlert}
          />
        );
      })}
    </div>
  );
}
