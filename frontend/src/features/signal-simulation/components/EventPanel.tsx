import { useTheme } from "../../../context/ThemeContext";
import type { SimulationEvent } from "../model/types";

type EventPanelProps = {
  events: SimulationEvent[];
};

export default function EventPanel({ events }: EventPanelProps) {
  const { theme } = useTheme();

  const severityColor = (severity: SimulationEvent["severity"]): string => {
    if (severity === "critical") return theme.colors.danger;
    if (severity === "warning") return theme.colors.warning;
    return theme.colors.textSecondary;
  };

  return (
    <div
      style={{
        maxHeight: 280,
        overflowY: "auto",
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radius.md,
        background: theme.colors.surfaceAlt,
      }}
    >
      {events.length === 0 ? (
        <div style={{ padding: theme.spacing.md, color: theme.colors.textSecondary }}>No recent simulation events.</div>
      ) : (
        events.map((event) => (
          <div
            key={event.id}
            style={{
              borderBottom: `1px solid ${theme.colors.border}`,
              padding: theme.spacing.sm,
              display: "grid",
              gap: theme.spacing.xs,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span
                style={{
                  color: severityColor(event.severity),
                  border: `1px solid ${severityColor(event.severity)}`,
                  borderRadius: theme.radius.md,
                  padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                  fontSize: 11,
                  textTransform: "uppercase",
                  background: theme.colors.surface,
                }}
              >
                {event.severity}
              </span>
              <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.body.fontSize }}>
                {new Date(event.ts).toLocaleTimeString()}
              </span>
            </div>
            <div>{event.message}</div>
          </div>
        ))
      )}
    </div>
  );
}
