import { useMemo, useRef } from "react";
import { useTheme } from "../../../context/ThemeContext";
import type { AlertRecord } from "../../../api/alerts";
import type { SmsDetectionRecord } from "../../../api/operatorDashboard";
import type { TriangulationResult } from "../../../api/rf";

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function isWithin1h(timestamp: string): boolean {
  return Date.now() - Date.parse(timestamp) < 3_600_000;
}

function trendArrow(current: number, previous: number): { label: string; color: string } {
  const delta = current - previous;
  if (Math.abs(delta) < 0.5) return { label: "—", color: "inherit" };
  return delta > 0 ? { label: "▲", color: "#EF4444" } : { label: "▼", color: "#22C55E" };
}

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  trendLabel?: string;
  trendColor?: string;
  accent?: string;
}

function MetricCard({ label, value, sub, trendLabel, trendColor, accent }: MetricCardProps) {
  const { theme } = useTheme();

  return (
    <div
      style={{
        background: theme.colors.surface,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: "10px",
        padding: `${theme.spacing.md} ${theme.spacing.lg}`,
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        borderTop: accent ? `3px solid ${accent}` : undefined,
      }}
    >
      <span
        style={{
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: theme.colors.textMuted,
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
        <span
          style={{
            fontSize: "30px",
            fontWeight: 700,
            lineHeight: 1,
            color: theme.colors.textPrimary,
          }}
        >
          {value}
        </span>
        {trendLabel && (
          <span style={{ fontSize: "13px", fontWeight: 600, color: trendColor }}>{trendLabel}</span>
        )}
      </div>
      {sub && (
        <span style={{ fontSize: "12px", color: theme.colors.textSecondary }}>{sub}</span>
      )}
    </div>
  );
}

interface DashboardMetricsRowProps {
  alerts: AlertRecord[];
  detections: SmsDetectionRecord[];
  triangulations: TriangulationResult[];
}

export default function DashboardMetricsRow({
  alerts,
  detections,
  triangulations,
}: DashboardMetricsRowProps) {
  const { theme } = useTheme();

  // Snapshot previous window for trend calculation
  const prevSnapshotRef = useRef<{
    activeAlerts: number;
    detections1h: number;
    avgSnr: number;
    dfFixes: number;
  } | null>(null);

  const metrics = useMemo(() => {
    const activeAlerts = alerts.filter(
      (a) => (a.status ?? "").toUpperCase() !== "RESOLVED"
    ).length;

    const criticalAlerts = alerts.filter((a) => {
      const s = (a.severity ?? "").toLowerCase();
      return s.includes("critical") || s.includes("high");
    }).length;

    const detections1h = detections.filter((d) => isWithin1h(d.timestamp_utc)).length;

    const snrValues = detections
      .map((d) => (d as any).snr as number | undefined)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    const avgSnr = snrValues.length > 0 ? mean(snrValues) : null;

    const dfFixes = triangulations.length;

    return { activeAlerts, criticalAlerts, detections1h, avgSnr, dfFixes };
  }, [alerts, detections, triangulations]);

  const prev = prevSnapshotRef.current;
  const alertTrend = trendArrow(metrics.activeAlerts, prev?.activeAlerts ?? metrics.activeAlerts);
  const detTrend = trendArrow(metrics.detections1h, prev?.detections1h ?? metrics.detections1h);
  const snrTrend = trendArrow(
    metrics.avgSnr ?? 0,
    prev?.avgSnr ?? metrics.avgSnr ?? 0
  );
  const dfTrend = trendArrow(metrics.dfFixes, prev?.dfFixes ?? metrics.dfFixes);

  // Update snapshot
  prevSnapshotRef.current = {
    activeAlerts: metrics.activeAlerts,
    detections1h: metrics.detections1h,
    avgSnr: metrics.avgSnr ?? 0,
    dfFixes: metrics.dfFixes,
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: theme.spacing.md,
      }}
    >
      <MetricCard
        label="Active Alerts"
        value={metrics.activeAlerts}
        sub={metrics.criticalAlerts > 0 ? `${metrics.criticalAlerts} critical` : "None critical"}
        trendLabel={alertTrend.label}
        trendColor={alertTrend.color}
        accent={metrics.criticalAlerts > 0 ? theme.colors.danger : theme.colors.success}
      />
      <MetricCard
        label="Detections (1h)"
        value={metrics.detections1h}
        sub="RF intercepts in past hour"
        trendLabel={detTrend.label}
        trendColor={detTrend.color}
        accent={theme.colors.primary}
      />
      <MetricCard
        label="Avg SNR"
        value={metrics.avgSnr !== null ? `${metrics.avgSnr.toFixed(1)} dB` : "—"}
        sub={metrics.avgSnr !== null ? "Signal quality" : "No data"}
        trendLabel={metrics.avgSnr !== null ? snrTrend.label : undefined}
        trendColor={snrTrend.color}
        accent={theme.colors.info}
      />
      <MetricCard
        label="DF Fixes"
        value={metrics.dfFixes}
        sub="Triangulation solutions"
        trendLabel={dfTrend.label}
        trendColor={dfTrend.color}
        accent={theme.colors.warning}
      />
    </div>
  );
}
