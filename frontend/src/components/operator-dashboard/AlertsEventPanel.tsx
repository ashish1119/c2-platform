import { useMemo } from "react";
import Card from "../ui/Card";
import { useTheme } from "../../context/ThemeContext";
import type { AlertRecord } from "../../api/alerts";
import type { SmsDetectionRecord } from "../../api/operatorDashboard";

type AlertsEventPanelProps = {
  alerts: AlertRecord[];
  detections: SmsDetectionRecord[];
};

type EventFeedItem = {
  id: string;
  kind: "alert" | "rf";
  title: string;
  detail: string;
  timeMs: number;
  severity: "critical" | "warning" | "info";
};

function resolveSeverity(value: string): "critical" | "warning" | "info" {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("critical") || normalized.includes("high")) {
    return "critical";
  }
  if (normalized.includes("medium") || normalized.includes("warn")) {
    return "warning";
  }
  return "info";
}

export default function AlertsEventPanel({ alerts, detections }: AlertsEventPanelProps) {
  const { theme } = useTheme();

  const alertSummary = useMemo(() => {
    let critical = 0;
    let warning = 0;
    let info = 0;
    let newCount = 0;

    for (const alert of alerts) {
      const severity = resolveSeverity(alert.severity ?? "info");
      if (severity === "critical") critical += 1;
      if (severity === "warning") warning += 1;
      if (severity === "info") info += 1;
      if ((alert.status ?? "").toUpperCase() === "NEW") newCount += 1;
    }

    return {
      total: alerts.length,
      critical,
      warning,
      info,
      newCount,
    };
  }, [alerts]);

  const events = useMemo<EventFeedItem[]>(() => {
    const alertEvents: EventFeedItem[] = alerts.map((alert) => {
      const timeMs = Date.parse(alert.created_at ?? "");
      const severity = resolveSeverity(alert.severity ?? "info");
      const typeLabel = (alert.alert_type ?? "RF Alert").trim() || "RF Alert";
      const title = alert.alert_name?.trim() || typeLabel;
      const detail = alert.description?.trim() || `${typeLabel} (${alert.status})`;

      return {
        id: `alert-${alert.id}`,
        kind: "alert",
        title,
        detail,
        timeMs: Number.isFinite(timeMs) ? timeMs : 0,
        severity,
      };
    });

    const rfEvents: EventFeedItem[] = detections
      .filter(
        (detection) =>
          (typeof detection.power_dbm === "number" && detection.power_dbm >= -65) ||
          (typeof detection.snr_db === "number" && detection.snr_db < 4)
      )
      .map((detection) => {
        const timeMs = Date.parse(detection.timestamp_utc);
        const isCritical = typeof detection.power_dbm === "number" && detection.power_dbm >= -55;

        return {
          id: `rf-${detection.id}`,
          kind: "rf",
          title: `${detection.source_node} detection`,
          detail: `${(detection.frequency_hz / 1_000_000).toFixed(3)} MHz | ${
            typeof detection.power_dbm === "number" ? `${detection.power_dbm.toFixed(1)} dBm` : "Power n/a"
          }`,
          timeMs: Number.isFinite(timeMs) ? timeMs : 0,
          severity: isCritical ? "critical" : "warning",
        };
      });

    return [...alertEvents, ...rfEvents]
      .sort((left, right) => right.timeMs - left.timeMs)
      .slice(0, 14);
  }, [alerts, detections]);

  const severityStyleByType = {
    critical: { color: theme.colors.danger, border: theme.colors.danger },
    warning: { color: theme.colors.warning, border: theme.colors.warning },
    info: { color: theme.colors.textSecondary, border: theme.colors.border },
  };

  return (
    <Card>
      <div style={{ display: "grid", gap: theme.spacing.md }}>
        <div>
          <h3 style={{ margin: 0 }}>Alerts & Event Panel</h3>
          <div style={{ color: theme.colors.textSecondary, marginTop: theme.spacing.xs }}>
            Combined security alerts and high-priority RF events.
          </div>
        </div>

        <div style={{ display: "grid", gap: theme.spacing.sm, gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
          <div style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt }}>
            <div style={{ color: theme.colors.textSecondary, fontSize: theme.typography.body.fontSize }}>Total Alerts</div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>{alertSummary.total}</div>
          </div>
          <div style={{ border: `1px solid ${theme.colors.danger}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt }}>
            <div style={{ color: theme.colors.danger, fontSize: theme.typography.body.fontSize }}>Critical</div>
            <div style={{ fontWeight: 700, fontSize: 20, color: theme.colors.danger }}>{alertSummary.critical}</div>
          </div>
          <div style={{ border: `1px solid ${theme.colors.warning}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt }}>
            <div style={{ color: theme.colors.warning, fontSize: theme.typography.body.fontSize }}>Warning</div>
            <div style={{ fontWeight: 700, fontSize: 20, color: theme.colors.warning }}>{alertSummary.warning}</div>
          </div>
          <div style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt }}>
            <div style={{ color: theme.colors.textSecondary, fontSize: theme.typography.body.fontSize }}>New</div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>{alertSummary.newCount}</div>
          </div>
        </div>

        <div
          style={{
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md,
            background: theme.colors.surfaceAlt,
            maxHeight: 290,
            overflowY: "auto",
          }}
        >
          {events.length === 0 ? (
            <div style={{ padding: theme.spacing.md, color: theme.colors.textSecondary }}>
              No alert or RF event entries available.
            </div>
          ) : (
            events.map((event) => {
              const severityStyle = severityStyleByType[event.severity];

              return (
                <div
                  key={event.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto",
                    alignItems: "center",
                    gap: theme.spacing.sm,
                    padding: theme.spacing.sm,
                    borderBottom: `1px solid ${theme.colors.border}`,
                  }}
                >
                  <span
                    style={{
                      border: `1px solid ${severityStyle.border}`,
                      color: severityStyle.color,
                      borderRadius: theme.radius.md,
                      padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                      fontSize: 11,
                      background: theme.colors.surface,
                      textTransform: "uppercase",
                    }}
                  >
                    {event.kind}
                  </span>

                  <div>
                    <div style={{ fontWeight: 600 }}>{event.title}</div>
                    <div style={{ color: theme.colors.textSecondary, fontSize: theme.typography.body.fontSize }}>{event.detail}</div>
                  </div>

                  <div style={{ color: theme.colors.textSecondary, fontSize: theme.typography.body.fontSize }}>
                    {event.timeMs > 0 ? new Date(event.timeMs).toLocaleTimeString() : "-"}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Card>
  );
}
