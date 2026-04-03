import { useMemo } from "react";
import { useTheme } from "../../../context/ThemeContext";
import type { AlertRecord } from "../../../api/alerts";
import type { SmsDetectionRecord } from "../../../api/operatorDashboard";

type Severity = "critical" | "warning" | "info";

interface FeedItem {
  id: string;
  kind: "alert" | "rf";
  title: string;
  detail: string;
  timeMs: number;
  severity: Severity;
}

function resolveSeverity(value: string): Severity {
  const n = value.trim().toLowerCase();
  if (n.includes("critical") || n.includes("high")) return "critical";
  if (n.includes("medium") || n.includes("warn")) return "warning";
  return "info";
}

function SeverityDot({ severity, theme }: { severity: Severity; theme: ReturnType<typeof useTheme>["theme"] }) {
  const colors: Record<Severity, string> = {
    critical: theme.colors.danger,
    warning: theme.colors.warning,
    info: theme.colors.textMuted,
  };
  return (
    <span
      style={{
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        background: colors[severity],
        display: "inline-block",
        flexShrink: 0,
        marginTop: "5px",
        boxShadow: severity === "critical" ? `0 0 6px ${colors.critical}` : "none",
      }}
    />
  );
}

function EmptyFeed({ theme }: { theme: ReturnType<typeof useTheme>["theme"] }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
        gap: "8px",
        color: theme.colors.textSecondary,
        fontSize: "13px",
      }}
    >
      <span style={{ fontSize: "24px" }}>✓</span>
      <span style={{ color: theme.colors.success, fontWeight: 600 }}>System nominal</span>
      <span>No active alerts</span>
    </div>
  );
}

interface AlertFeedProps {
  alerts: AlertRecord[];
  detections: SmsDetectionRecord[];
  maxItems?: number;
}

export default function AlertFeed({
  alerts,
  detections,
  maxItems = 40,
}: AlertFeedProps) {
  const { theme } = useTheme();

  const summary = useMemo(() => {
    let critical = 0;
    let warning = 0;
    let newCount = 0;
    for (const a of alerts) {
      const sev = resolveSeverity(a.severity ?? "info");
      if (sev === "critical") critical++;
      else if (sev === "warning") warning++;
      if ((a.status ?? "").toUpperCase() === "NEW") newCount++;
    }
    return { total: alerts.length, critical, warning, newCount };
  }, [alerts]);

  const items = useMemo<FeedItem[]>(() => {
    const alertItems: FeedItem[] = alerts.map((a) => {
      const timeMs = Date.parse(a.created_at ?? "");
      const severity = resolveSeverity(a.severity ?? "info");
      const typeLabel = (a.alert_type ?? "RF Alert").trim() || "RF Alert";
      const title = a.alert_name?.trim() || typeLabel;
      const detail = a.description?.trim() || `${typeLabel} (${a.status})`;
      return { id: `alert-${a.id}`, kind: "alert", title, detail, timeMs: Number.isFinite(timeMs) ? timeMs : 0, severity };
    });

    const rfItems: FeedItem[] = detections
      .filter(
        (d) =>
          (typeof d.power_dbm === "number" && d.power_dbm >= -65) ||
          (typeof (d as any).snr_db === "number" && (d as any).snr_db < 4)
      )
      .map((d) => {
        const timeMs = Date.parse(d.timestamp_utc);
        const isCritical = typeof d.power_dbm === "number" && d.power_dbm >= -55;
        return {
          id: `rf-${d.id}`,
          kind: "rf",
          title: `${d.source_node} detection`,
          detail: `${(d.frequency_hz / 1_000_000).toFixed(3)} MHz | ${typeof d.power_dbm === "number" ? `${d.power_dbm.toFixed(1)} dBm` : "Power n/a"}`,
          timeMs: Number.isFinite(timeMs) ? timeMs : 0,
          severity: isCritical ? "critical" : "warning",
        };
      });

    return [...alertItems, ...rfItems]
      .sort((a, b) => b.timeMs - a.timeMs)
      .slice(0, maxItems);
  }, [alerts, detections, maxItems]);

  const severityColors: Record<Severity, string> = {
    critical: theme.colors.danger,
    warning: theme.colors.warning,
    info: theme.colors.textMuted,
  };

  return (
    <div
      style={{
        background: theme.colors.surface,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: "10px",
        display: "flex",
        flexDirection: "column",
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
          Alerts & Events
        </span>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {summary.critical > 0 && (
            <span
              style={{
                padding: "2px 8px",
                borderRadius: "4px",
                background: theme.colors.danger + "20",
                border: `1px solid ${theme.colors.danger}`,
                color: theme.colors.danger,
                fontSize: "11px",
                fontWeight: 700,
              }}
            >
              {summary.critical} CRITICAL
            </span>
          )}
          {summary.warning > 0 && (
            <span
              style={{
                padding: "2px 8px",
                borderRadius: "4px",
                background: theme.colors.warning + "20",
                border: `1px solid ${theme.colors.warning}`,
                color: theme.colors.warning,
                fontSize: "11px",
                fontWeight: 600,
              }}
            >
              {summary.warning} WARN
            </span>
          )}
          <span style={{ fontSize: "11px", color: theme.colors.textMuted }}>{summary.total} total</span>
        </div>
      </div>

      {/* Feed */}
      <div
        style={{
          maxHeight: "420px",
          overflowY: "auto",
          flex: 1,
        }}
      >
        {items.length === 0 ? (
          <EmptyFeed theme={theme} />
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                gap: "12px",
                padding: `10px ${theme.spacing.lg}`,
                borderBottom: `1px solid ${theme.colors.border}`,
                borderLeft: `3px solid ${severityColors[item.severity]}`,
              }}
            >
              <SeverityDot severity={item.severity} theme={theme} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: "13px",
                      color: theme.colors.textPrimary,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {item.title}
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      color: theme.colors.textMuted,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {item.timeMs > 0 ? new Date(item.timeMs).toLocaleTimeString() : "-"}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: theme.colors.textSecondary,
                    marginTop: "2px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.detail}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
